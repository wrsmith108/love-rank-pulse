/**
 * Redis Pub/Sub Manager for Multi-Server WebSocket Coordination
 *
 * Provides publisher and subscriber functionality for distributing
 * real-time events across multiple server instances.
 *
 * Architecture:
 * - Publisher: Services publish events to Redis channels
 * - Subscriber: All servers subscribe and broadcast to local WebSocket clients
 * - Message broker: Redis ensures reliable delivery across instances
 *
 * @module websocket/redis/pubsub
 */

import { createClient, RedisClientType } from 'redis';
import { getRedisClient } from '../../utils/redisClient';
import {
  REDIS_CHANNELS,
  RedisChannel,
  RedisEventPayload,
  ChannelEventMap,
  createServerId,
  isValidEventPayload,
} from './channels';

/**
 * Subscription callback function type
 */
export type SubscriptionCallback<T extends RedisEventPayload> = (
  event: T,
  channel: RedisChannel
) => void | Promise<void>;

/**
 * Publisher statistics
 */
interface PublisherStats {
  totalPublished: number;
  successfulPublishes: number;
  failedPublishes: number;
  lastPublishTime: number | null;
  channelStats: Record<string, number>;
}

/**
 * Subscriber statistics
 */
interface SubscriberStats {
  totalReceived: number;
  processedEvents: number;
  failedEvents: number;
  lastReceiveTime: number | null;
  channelStats: Record<string, number>;
}

/**
 * Redis Pub/Sub Manager
 */
export class RedisPubSubManager {
  private publisherClient: RedisClientType | null = null;
  private subscriberClient: RedisClientType | null = null;
  private serverId: string;
  private subscriptions: Map<RedisChannel, Set<SubscriptionCallback<any>>> = new Map();
  private isSubscriberReady = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  // Statistics
  private publisherStats: PublisherStats = {
    totalPublished: 0,
    successfulPublishes: 0,
    failedPublishes: 0,
    lastPublishTime: null,
    channelStats: {},
  };

  private subscriberStats: SubscriberStats = {
    totalReceived: 0,
    processedEvents: 0,
    failedEvents: 0,
    lastReceiveTime: null,
    channelStats: {},
  };

  constructor(serverId?: string) {
    this.serverId = serverId || createServerId();
  }

  /**
   * Initialize both publisher and subscriber clients
   */
  async initialize(): Promise<void> {
    try {
      // Get main Redis client for publishing
      this.publisherClient = await getRedisClient();

      // Create dedicated subscriber client (required by Redis pub/sub model)
      this.subscriberClient = await this.createSubscriberClient();

      // Set up subscriber event handlers
      this.setupSubscriberHandlers();

      console.log(`[RedisPubSub] Initialized for server ${this.serverId}`);
    } catch (error) {
      console.error('[RedisPubSub] Initialization failed:', error);
      throw new Error(`Redis Pub/Sub initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a dedicated subscriber client
   * Redis requires separate connections for pub/sub operations
   */
  private async createSubscriberClient(): Promise<RedisClientType> {
    const config = {
      url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      password: process.env.REDIS_PASSWORD,
    };

    const client = createClient(config);

    client.on('error', (error) => {
      console.error('[RedisPubSub] Subscriber error:', error);
      this.isSubscriberReady = false;
    });

    client.on('reconnecting', () => {
      console.log('[RedisPubSub] Subscriber reconnecting...');
      this.reconnectAttempts++;
      this.isSubscriberReady = false;
    });

    client.on('ready', () => {
      console.log('[RedisPubSub] Subscriber ready');
      this.isSubscriberReady = true;
      this.reconnectAttempts = 0;
    });

    await client.connect();
    return client;
  }

  /**
   * Set up message handlers for subscriber
   */
  private setupSubscriberHandlers(): void {
    if (!this.subscriberClient) {
      throw new Error('Subscriber client not initialized');
    }

    // Handle incoming messages
    this.subscriberClient.on('message', (channel: string, message: string) => {
      this.handleIncomingMessage(channel as RedisChannel, message);
    });
  }

  /**
   * Handle incoming Redis pub/sub message
   */
  private async handleIncomingMessage(channel: RedisChannel, message: string): Promise<void> {
    this.subscriberStats.totalReceived++;
    this.subscriberStats.lastReceiveTime = Date.now();
    this.subscriberStats.channelStats[channel] = (this.subscriberStats.channelStats[channel] || 0) + 1;

    try {
      // Deserialize message
      const event = this.deserializeMessage(message);

      // Validate payload
      if (!isValidEventPayload(event)) {
        console.warn('[RedisPubSub] Invalid event payload received:', message);
        this.subscriberStats.failedEvents++;
        return;
      }

      // Skip messages from same server to avoid duplicate processing
      if (event.serverId === this.serverId) {
        return;
      }

      // Execute all callbacks for this channel
      const callbacks = this.subscriptions.get(channel);
      if (callbacks && callbacks.size > 0) {
        await Promise.all(
          Array.from(callbacks).map(async (callback) => {
            try {
              await callback(event, channel);
              this.subscriberStats.processedEvents++;
            } catch (error) {
              console.error('[RedisPubSub] Callback execution failed:', error);
              this.subscriberStats.failedEvents++;
            }
          })
        );
      }
    } catch (error) {
      console.error('[RedisPubSub] Message handling failed:', error);
      this.subscriberStats.failedEvents++;
    }
  }

  /**
   * Publish an event to a Redis channel
   */
  async publish<T extends RedisChannel>(
    channel: T,
    event: Omit<ChannelEventMap[T], 'serverId' | 'timestamp'>
  ): Promise<void> {
    if (!this.publisherClient) {
      throw new Error('Publisher client not initialized. Call initialize() first.');
    }

    this.publisherStats.totalPublished++;
    this.publisherStats.channelStats[channel] = (this.publisherStats.channelStats[channel] || 0) + 1;

    // Add server metadata
    const fullEvent: ChannelEventMap[T] = {
      ...event,
      serverId: this.serverId,
      timestamp: Date.now(),
    } as ChannelEventMap[T];

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Serialize and publish
        const message = this.serializeMessage(fullEvent);
        await this.publisherClient.publish(channel, message);

        this.publisherStats.successfulPublishes++;
        this.publisherStats.lastPublishTime = Date.now();

        console.log(`[RedisPubSub] Published to ${channel}:`, event.type);
        return;
      } catch (error) {
        retryCount++;
        console.error(`[RedisPubSub] Publish failed (attempt ${retryCount}/${maxRetries}):`, error);

        if (retryCount >= maxRetries) {
          this.publisherStats.failedPublishes++;
          throw new Error(`Failed to publish after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, retryCount) * 100);
      }
    }
  }

  /**
   * Subscribe to a Redis channel
   */
  async subscribe<T extends RedisChannel>(
    channel: T,
    callback: SubscriptionCallback<ChannelEventMap[T]>
  ): Promise<void> {
    if (!this.subscriberClient) {
      throw new Error('Subscriber client not initialized. Call initialize() first.');
    }

    // Add callback to subscriptions map
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callback);

    // Subscribe to Redis channel if first subscription
    if (this.subscriptions.get(channel)!.size === 1) {
      await this.subscriberClient.subscribe(channel, () => {
        console.log(`[RedisPubSub] Subscribed to ${channel}`);
      });
    }
  }

  /**
   * Unsubscribe from a Redis channel
   */
  async unsubscribe<T extends RedisChannel>(
    channel: T,
    callback?: SubscriptionCallback<ChannelEventMap[T]>
  ): Promise<void> {
    if (!this.subscriberClient) {
      return;
    }

    const channelCallbacks = this.subscriptions.get(channel);
    if (!channelCallbacks) {
      return;
    }

    // Remove specific callback or all callbacks
    if (callback) {
      channelCallbacks.delete(callback);
    } else {
      channelCallbacks.clear();
    }

    // Unsubscribe from Redis if no more callbacks
    if (channelCallbacks.size === 0) {
      await this.subscriberClient.unsubscribe(channel);
      this.subscriptions.delete(channel);
      console.log(`[RedisPubSub] Unsubscribed from ${channel}`);
    }
  }

  /**
   * Subscribe to all channels
   */
  async subscribeAll(callback: SubscriptionCallback<RedisEventPayload>): Promise<void> {
    await Promise.all(
      Object.values(REDIS_CHANNELS).map((channel) => this.subscribe(channel, callback))
    );
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.subscriptions.keys()).map((channel) => this.unsubscribe(channel))
    );
  }

  /**
   * Serialize message to JSON string
   */
  private serializeMessage(event: RedisEventPayload): string {
    try {
      return JSON.stringify(event);
    } catch (error) {
      throw new Error(`Message serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserialize message from JSON string
   */
  private deserializeMessage(message: string): RedisEventPayload {
    try {
      return JSON.parse(message);
    } catch (error) {
      throw new Error(`Message deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get publisher statistics
   */
  getPublisherStats(): Readonly<PublisherStats> {
    return { ...this.publisherStats };
  }

  /**
   * Get subscriber statistics
   */
  getSubscriberStats(): Readonly<SubscriberStats> {
    return { ...this.subscriberStats };
  }

  /**
   * Check health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    publisherReady: boolean;
    subscriberReady: boolean;
    serverId: string;
    activeSubscriptions: number;
    reconnectAttempts: number;
  } {
    return {
      isHealthy: this.isSubscriberReady && this.reconnectAttempts < this.maxReconnectAttempts,
      publisherReady: this.publisherClient !== null,
      subscriberReady: this.isSubscriberReady,
      serverId: this.serverId,
      activeSubscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.publisherStats = {
      totalPublished: 0,
      successfulPublishes: 0,
      failedPublishes: 0,
      lastPublishTime: null,
      channelStats: {},
    };

    this.subscriberStats = {
      totalReceived: 0,
      processedEvents: 0,
      failedEvents: 0,
      lastReceiveTime: null,
      channelStats: {},
    };
  }

  /**
   * Gracefully shutdown pub/sub manager
   */
  async shutdown(): Promise<void> {
    console.log('[RedisPubSub] Shutting down...');

    // Unsubscribe from all channels
    await this.unsubscribeAll();

    // Disconnect subscriber client
    if (this.subscriberClient) {
      try {
        await this.subscriberClient.quit();
      } catch (error) {
        console.error('[RedisPubSub] Error disconnecting subscriber:', error);
      }
      this.subscriberClient = null;
    }

    this.publisherClient = null;
    this.isSubscriberReady = false;

    console.log('[RedisPubSub] Shutdown complete');
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get server ID
   */
  getServerId(): string {
    return this.serverId;
  }
}

/**
 * Singleton instance for global access
 */
let pubSubInstance: RedisPubSubManager | null = null;

/**
 * Get or create singleton pub/sub manager instance
 */
export async function getPubSubManager(serverId?: string): Promise<RedisPubSubManager> {
  if (!pubSubInstance) {
    pubSubInstance = new RedisPubSubManager(serverId);
    await pubSubInstance.initialize();
  }
  return pubSubInstance;
}

/**
 * Shutdown singleton instance
 */
export async function shutdownPubSub(): Promise<void> {
  if (pubSubInstance) {
    await pubSubInstance.shutdown();
    pubSubInstance = null;
  }
}

// Graceful shutdown on process termination
process.on('SIGINT', async () => {
  await shutdownPubSub();
});

process.on('SIGTERM', async () => {
  await shutdownPubSub();
});
