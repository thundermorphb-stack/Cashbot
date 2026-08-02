// The job pool.
// Rarer jobs give a bigger income bonus on everything you earn.
// To add a job, just add a name to the right rarity's list.

export const RARITIES = {
  common: {
    label: "Common",
    weight: 45, // out of 100 — chance of rolling this rarity
    minBonus: 0.05,
    maxBonus: 0.1,
    color: 0x95a5a6, // gray
    jobs: ["Cashier", "Janitor", "Dog Walker", "Barista", "Delivery Driver", "Dishwasher"],
  },
  uncommon: {
    label: "Uncommon",
    weight: 30,
    minBonus: 0.1,
    maxBonus: 0.2,
    color: 0x2ecc71, // green
    jobs: ["Electrician", "Chef", "Mechanic", "Teacher", "Plumber"],
  },
  rare: {
    label: "Rare",
    weight: 15,
    minBonus: 0.2,
    maxBonus: 0.35,
    color: 0x3498db, // blue
    jobs: ["Software Engineer", "Lawyer", "Pilot", "Architect"],
  },
  epic: {
    label: "Epic",
    weight: 7,
    minBonus: 0.35,
    maxBonus: 0.5,
    color: 0x9b59b6, // purple
    jobs: ["Surgeon", "Investment Banker", "Pro Gamer"],
  },
  legendary: {
    label: "Legendary",
    weight: 3,
    minBonus: 0.5,
    maxBonus: 1.0,
    color: 0xf39c12, // gold
    jobs: ["CEO", "Rock Star", "Astronaut"],
  },
} as const;

export type Rarity = keyof typeof RARITIES;
