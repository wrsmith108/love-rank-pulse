/**
 * Utility functions for generating mock data
 */

// List of realistic usernames for gaming
const usernames = [
  'ShadowStriker', 'NightHawk', 'PhantomAce', 'BlitzKrieg', 'VortexPro',
  'IronSight', 'TacticalOps', 'StealthMode', 'ReaperMain', 'CyberNinja',
  'QuantumSniper', 'FrostByte', 'ThunderBolt', 'WraithHunter', 'NovaForce',
  'EliteSharpshooter', 'RapidFire', 'SilentAssassin', 'GhostProtocol', 'ApexPredator',
  'DarkMatter', 'VenomStrike', 'CrimsonTide', 'OmegaWolf', 'SpecterElite',
  'TitanFury', 'CosmicRay', 'SavageHunter', 'PulseFire', 'ShadowPhoenix',
  'MidnightStalker', 'RogueAgent', 'ViperSquad', 'DragonFist', 'EagleEye',
  'PrecisionStrike', 'SteelTempest', 'ThunderStorm', 'NeonBlade', 'CarbonFrost',
  'QuantumLeap', 'SolarFlare', 'LunarEclipse', 'CyberPulse', 'AtomicBlast',
  'ShadowWalker', 'FrostGiant', 'InfernoRage', 'ToxicAvenger', 'PhantomSniper',
  'MercyKiller', 'DeadlyVenom', 'SilentShadow', 'RuthlessHunter', 'FatalStrike',
  'DarkAssassin', 'NightmareReaper', 'GhostRider', 'SavageBeast', 'ThunderGod',
  'FrostBite', 'InfernoBlaze', 'ShadowDancer', 'StormRider', 'RapidStrike',
  'SilentScope', 'DeadEye', 'NightStalker', 'PhantomBlade', 'VenomousBite',
  'CrimsonFang', 'SteelShadow', 'ToxicShock', 'DarkPhoenix', 'FrostFire',
  'ThunderHawk', 'ShadowWolf', 'BloodHunter', 'IronFist', 'GhostSniper',
  'DeathWhisper', 'VoidWalker', 'NightFury', 'SilentKiller', 'RapidHawk',
  'FrostWolf', 'FireStorm', 'ShadowBlade', 'ThunderStrike', 'VenomBlade',
  'CrimsonHawk', 'SteelPhoenix', 'ToxicBlade', 'DarkWolf', 'FrostBlade'
];

// List of country codes
const countryCodes = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'RU', 'CN',
  'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL', 'KR', 'IN',
  'MX', 'AR', 'ZA', 'SG', 'MY', 'ID', 'TH', 'PH', 'VN', 'TR'
];

// List of map names
const mapNames = [
  'Dust Storm', 'Neon City', 'Arctic Base', 'Jungle Ruins', 'Desert Outpost',
  'Urban Sprawl', 'Mountain Pass', 'Nuclear Silo', 'Space Station', 'Abandoned Mall',
  'Military Compound', 'Cargo Ship', 'Oil Rig', 'Power Plant', 'Underground Bunker'
];

// List of weapon names
const weaponNames = [
  'AK-47 Tactical', 'M4A1 Carbine', 'Desert Eagle', 'AWP Sniper', 'MP5 Submachine Gun',
  'SCAR-H Assault', 'P90 Rush', 'Glock-18 Sidearm', 'Remington Shotgun', 'Barrett .50 Cal',
  'UMP-45 Tactical', 'Five-Seven Pistol', 'M249 SAW', 'G36C Rifle', 'USP Tactical',
  'RPG-7 Launcher', 'MAC-10 SMG', 'Dragunov SVD', 'FAMAS Burst', 'Galil ACE'
];

/**
 * Generate a random integer between min and max (inclusive)
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max with specified precision
 * @param min Minimum value
 * @param max Maximum value
 * @param precision Number of decimal places
 * @returns Random float
 */
export function randomFloat(min: number, max: number, precision: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(precision));
}

/**
 * Generate a random boolean with specified probability
 * @param probability Probability of true (0-1)
 * @returns Random boolean
 */
export function randomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Generate a random date between start and end dates
 * @param start Start date
 * @param end End date
 * @returns Random date
 */
export function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a random element from an array
 * @param array Array to pick from
 * @returns Random element
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random subset of an array
 * @param array Array to pick from
 * @param count Number of elements to pick
 * @returns Random subset
 */
export function randomSubset<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Generate a random username
 * @returns Random username
 */
export function randomUsername(): string {
  return randomElement(usernames);
}

/**
 * Generate a random country code
 * @returns Random country code
 */
export function randomCountryCode(): string {
  return randomElement(countryCodes);
}

/**
 * Generate a random map name
 * @returns Random map name
 */
export function randomMapName(): string {
  return randomElement(mapNames);
}

/**
 * Generate a random weapon name
 * @returns Random weapon name
 */
export function randomWeaponName(): string {
  return randomElement(weaponNames);
}

/**
 * Generate a random email based on a username
 * @param username Username to base email on
 * @returns Random email
 */
export function randomEmail(username: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  return `${username.toLowerCase().replace(/\s+/g, '.')}@${randomElement(domains)}`;
}

/**
 * Generate a random ID
 * @param prefix Prefix for the ID
 * @returns Random ID
 */
export function randomId(prefix: string = ''): string {
  return `${prefix}${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a random K/D ratio based on skill level
 * @param skillLevel Skill level (0-1)
 * @returns Random K/D ratio
 */
export function randomKdRatio(skillLevel: number): number {
  // Higher skill level = higher average K/D
  const baseKd = 0.5 + skillLevel * 2.5;
  // Add some randomness
  return randomFloat(baseKd * 0.7, baseKd * 1.3, 2);
}

/**
 * Generate random performance metrics based on skill level
 * @param skillLevel Skill level (0-1)
 * @returns Object with performance metrics
 */
export function randomPerformanceMetrics(skillLevel: number): {
  kills: number;
  deaths: number;
  kdRatio: number;
  headshots: number;
  accuracy: number;
} {
  const kdRatio = randomKdRatio(skillLevel);
  const kills = randomInt(10, 500);
  const deaths = Math.round(kills / kdRatio);
  const headshots = Math.round(kills * randomFloat(0.1, 0.5, 2));
  const accuracy = randomInt(20, 80);
  
  return {
    kills,
    deaths,
    kdRatio,
    headshots,
    accuracy
  };
}

/**
 * Generate a random win rate based on skill level
 * @param skillLevel Skill level (0-1)
 * @returns Random win rate (0-100)
 */
export function randomWinRate(skillLevel: number): number {
  // Higher skill level = higher win rate
  const baseWinRate = 30 + skillLevel * 50;
  // Add some randomness
  return randomInt(baseWinRate * 0.8, baseWinRate * 1.2);
}

/**
 * Generate random match statistics
 * @returns Object with match statistics
 */
export function randomMatchStats(): {
  duration: number;
  playerCount: number;
  spectatorCount: number;
} {
  return {
    duration: randomInt(300, 1800), // 5-30 minutes in seconds
    playerCount: randomInt(8, 32),
    spectatorCount: randomInt(0, 20)
  };
}

/**
 * Generate a random performance trend
 * @returns Random performance trend
 */
export function randomPerformanceTrend(): 'improving' | 'steady' | 'declining' {
  const trends: ('improving' | 'steady' | 'declining')[] = ['improving', 'steady', 'declining'];
  return randomElement(trends);
}

/**
 * Generate a random avatar URL
 * @param username Username to base avatar on
 * @returns Random avatar URL
 */
export function randomAvatarUrl(username: string): string {
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `https://avatars.dicebear.com/api/avataaars/${hash}.svg`;
}