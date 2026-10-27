export interface TypingPassage {
  id: string;
  title: string;
  text: string;
  wordCount: number;
}

export const TYPING_PASSAGES: TypingPassage[] = [
  {
    id: "grand-prix-dawn",
    title: "Grand Prix Dawn",
    text: "The morning sun broke across the curved raceway as twin turbocharged beasts idled on the grid. Crisp air carried the sharp scent of burnt rubber. When the signal turned green, four hundred horsepower surged through the rear axles, sending both machines screaming down the straightaway.",
    wordCount: 45,
  },
  {
    id: "cosmic-odyssey",
    title: "Cosmic Odyssey",
    text: "Deep within the outer asteroid belt, a lonely scout vessel surveyed ancient planetary rings glistening beneath distant starlight. Navigational thrusters fired brief bursts of argon plasma, correcting trajectory. Ahead lay an uncharted gravitational anomaly pulsing with radiant energy, inviting the daring pilot into the cosmic deep.",
    wordCount: 45,
  },
  {
    id: "neon-cyberpunk",
    title: "Neon Cyberpunk",
    text: "Rain fell in steady sheets across the towering glass spires of Neo Tokyo, reflecting vibrant holographic advertisements into dark street puddles below. Inside a quiet workshop, an engineer calibrated a customized racing skimmer. Every circuit glowed with electric cyan luminescence as the power core reached maximum equilibrium.",
    wordCount: 45,
  },
  {
    id: "mountain-switchbacks",
    title: "Mountain Switchbacks",
    text: "High alpine passes carved perilous switchbacks through jagged granite peaks shrouded in dense morning mist. Two lightweight sports coupes drifted through tight hairpin turns, tires squealing at the limits of adhesion. Downshifting with rapid heel-toe precision, the lead driver balanced throttle along the sheer cliff edge.",
    wordCount: 45,
  },
  {
    id: "desert-dunes",
    title: "Desert Dunes",
    text: "Endless rolling dunes stretched toward the shimmering horizon beneath the blistering desert heat. Specially modified rally trucks launched across razor crests, leaving massive rooster tails of golden sand suspended in dry air. High-travel suspension absorbed relentless impacts from rocky outcrops toward the distant checkered flag.",
    wordCount: 45,
  },
  {
    id: "deep-ocean-explorer",
    title: "Deep Ocean Explorer",
    text: "Submerged three miles beneath the Atlantic, a titanium bathysphere navigated towering hydrothermal vents spewing superheated mineral plumes into the freezing abyss. Powerful halogen floodlights cut through eternal gloom, revealing extraordinary translucent jellyfish. Sonar pings resonated against canyons as researchers documented secrets hidden from human civilization.",
    wordCount: 45,
  },
  {
    id: "ancient-forest-sprint",
    title: "Ancient Forest Sprint",
    text: "Sunlight filtered through ancient redwood canopies as sleek electric racers glided silently along winding coastal asphalt. Towering trunks stood like cathedral pillars beside the twisting roadway, moss damp with ocean fog. Instant battery torque propelled the vehicles out of sweeping bends with breathtaking, whisper-quiet acceleration.",
    wordCount: 45,
  },
  {
    id: "velocity-mirage",
    title: "Velocity Mirage",
    text: "The straightaway seemed to ripple under the shimmering mirage of midday heat. Aerodynamic wings pressed the chassis firmly against smooth racing tarmac as speedometers climbed past two hundred miles per hour. Wind buffeted the carbon cockpit, testing driver nerve as both competitors pushed toward victory.",
    wordCount: 45,
  },
  {
    id: "steam-and-steel",
    title: "Steam and Steel",
    text: "Huge brass gears turned with rhythmic clattering inside the belly of the grand iron locomotive. Plumes of dense white steam billowed into the cold mountain air as firemen shoveled coal into roaring flames. Steel wheels pounded heavy rails at breakneck speeds, racing across expansive viaducts.",
    wordCount: 45,
  },
  {
    id: "midnight-drift",
    title: "Midnight Drift",
    text: "Under the glow of sodium streetlights, two street racers entered the wide harbor boulevard side by side. Quick tugs on hydraulic handbrakes threw both rear ends into coordinated sideways slides, tires smoking against abrasive concrete. Countersteering with fluid precision, the drivers rocketed together toward the bridge crossing.",
    wordCount: 45,
  },
];

export function getRandomPassage(excludeId?: string): TypingPassage {
  const available = excludeId
    ? TYPING_PASSAGES.filter((p) => p.id !== excludeId)
    : TYPING_PASSAGES;
  const list = available.length > 0 ? available : TYPING_PASSAGES;
  const index = Math.floor(Math.random() * list.length);
  return list[index]!;
}
