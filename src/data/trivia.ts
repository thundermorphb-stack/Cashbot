// The trivia question bank.
// To add a question: copy one block, change the text, done.
// "correct" is the right answer; "wrong" holds exactly three wrong answers.
// The bot shuffles the answer order every time, so positions never repeat.

export interface TriviaQuestion {
  question: string;
  correct: string;
  wrong: [string, string, string];
}

export const TRIVIA_CATEGORIES = {
  general: "🌍 General Knowledge",
  gaming: "🎮 Gaming",
  science: "🔬 Science",
  history: "📜 History",
} as const;

export type TriviaCategory = keyof typeof TRIVIA_CATEGORIES;

export const TRIVIA: Record<TriviaCategory, TriviaQuestion[]> = {
  general: [
    { question: "What is the capital of Australia?", correct: "Canberra", wrong: ["Sydney", "Melbourne", "Perth"] },
    { question: "How many time zones does Russia span?", correct: "11", wrong: ["7", "9", "13"] },
    { question: "Which language has the most native speakers?", correct: "Mandarin Chinese", wrong: ["English", "Spanish", "Hindi"] },
    { question: "What is the smallest country in the world?", correct: "Vatican City", wrong: ["Monaco", "San Marino", "Liechtenstein"] },
    { question: "Which planet is closest to the Sun?", correct: "Mercury", wrong: ["Venus", "Mars", "Earth"] },
    { question: "What currency is used in Japan?", correct: "Yen", wrong: ["Won", "Yuan", "Ringgit"] },
    { question: "How many strings does a standard violin have?", correct: "4", wrong: ["5", "6", "7"] },
    { question: "Which ocean is the deepest?", correct: "Pacific", wrong: ["Atlantic", "Indian", "Arctic"] },
    { question: "What is the longest river in the world?", correct: "Nile", wrong: ["Amazon", "Yangtze", "Mississippi"] },
    { question: "Which country invented pizza?", correct: "Italy", wrong: ["Greece", "France", "Spain"] },
    { question: "How many continents are there?", correct: "7", wrong: ["5", "6", "8"] },
    { question: "What is the tallest mountain on Earth?", correct: "Mount Everest", wrong: ["K2", "Kilimanjaro", "Mont Blanc"] },
    { question: "What is a baby kangaroo called?", correct: "A joey", wrong: ["A cub", "A kit", "A calf"] },
    { question: "Which metal is liquid at room temperature?", correct: "Mercury", wrong: ["Aluminium", "Tin", "Sodium"] },
    { question: "What is the largest desert in the world?", correct: "Antarctica", wrong: ["The Sahara", "The Gobi", "The Arabian"] },
    { question: "How many minutes are in a full day?", correct: "1440", wrong: ["1240", "1480", "1640"] },
    { question: "Which fruit wears its seeds on the outside?", correct: "Strawberry", wrong: ["Raspberry", "Blueberry", "Fig"] },
    { question: "What is the national animal of Scotland?", correct: "The unicorn", wrong: ["The lion", "The stag", "The eagle"] },
    { question: "How many colors are in a rainbow?", correct: "7", wrong: ["5", "6", "8"] },
    { question: "Which planet has the most moons discovered so far?", correct: "Saturn", wrong: ["Jupiter", "Uranus", "Neptune"] },
  ],
  gaming: [
    { question: "What company makes the PlayStation?", correct: "Sony", wrong: ["Microsoft", "Nintendo", "Sega"] },
    { question: "In Minecraft, what material do you need to mine diamonds?", correct: "Iron pickaxe", wrong: ["Stone pickaxe", "Gold pickaxe", "Wooden pickaxe"] },
    { question: "Which game features the character Master Chief?", correct: "Halo", wrong: ["Doom", "Destiny", "Gears of War"] },
    { question: "What is the best-selling video game of all time?", correct: "Minecraft", wrong: ["Tetris", "GTA V", "Wii Sports"] },
    { question: "In chess, which piece can only move diagonally?", correct: "Bishop", wrong: ["Rook", "Knight", "Queen"] },
    { question: "What year was the original Pokémon Red/Green released in Japan?", correct: "1996", wrong: ["1994", "1998", "2000"] },
    { question: "Which company created Mario?", correct: "Nintendo", wrong: ["Sega", "Capcom", "Atari"] },
    { question: "In Fortnite, what is the name of the in-game currency?", correct: "V-Bucks", wrong: ["Robux", "Gold Bars", "Credits"] },
    { question: "What genre is the game Stardew Valley?", correct: "Farming simulation", wrong: ["First-person shooter", "Racing", "Fighting"] },
    { question: "Which game series features the Dovahkiin?", correct: "The Elder Scrolls", wrong: ["Dark Souls", "The Witcher", "Dragon Age"] },
    { question: "What color is Pac-Man?", correct: "Yellow", wrong: ["Red", "Blue", "Green"] },
    { question: "In Among Us, what are the killers called?", correct: "Impostors", wrong: ["Traitors", "Hunters", "Agents"] },
    { question: "Which game declared that 'the cake is a lie'?", correct: "Portal", wrong: ["Half-Life", "BioShock", "Fallout"] },
    { question: "What kind of animal is Sonic?", correct: "A hedgehog", wrong: ["A fox", "A rabbit", "A porcupine"] },
    { question: "Which company makes the Xbox?", correct: "Microsoft", wrong: ["Sony", "Nintendo", "Valve"] },
    { question: "In Minecraft, which mob hisses before exploding?", correct: "Creeper", wrong: ["Zombie", "Skeleton", "Enderman"] },
    { question: "What is Link's legendary sword called in Zelda?", correct: "The Master Sword", wrong: ["The Blade of Time", "Excalibur", "The Hero's Edge"] },
    { question: "Which battle royale features the Tilted Towers location?", correct: "Fortnite", wrong: ["PUBG", "Apex Legends", "Warzone"] },
    { question: "What does RPG stand for in gaming?", correct: "Role-Playing Game", wrong: ["Rapid Player Game", "Real Player Guild", "Ranked PvP Game"] },
    { question: "Which studio made The Witcher 3?", correct: "CD Projekt Red", wrong: ["Ubisoft", "BioWare", "Bethesda"] },
  ],
  science: [
    { question: "What is the chemical symbol for gold?", correct: "Au", wrong: ["Ag", "Go", "Gd"] },
    { question: "How many bones does an adult human have?", correct: "206", wrong: ["186", "226", "254"] },
    { question: "What gas do plants absorb from the air?", correct: "Carbon dioxide", wrong: ["Oxygen", "Nitrogen", "Hydrogen"] },
    { question: "What is the speed of light (approximately)?", correct: "300,000 km/s", wrong: ["150,000 km/s", "500,000 km/s", "1,000,000 km/s"] },
    { question: "Which organ produces insulin?", correct: "Pancreas", wrong: ["Liver", "Kidney", "Spleen"] },
    { question: "What is the hardest natural substance on Earth?", correct: "Diamond", wrong: ["Titanium", "Quartz", "Tungsten"] },
    { question: "How many planets in our solar system have rings?", correct: "4", wrong: ["1", "2", "3"] },
    { question: "What particle has a negative electric charge?", correct: "Electron", wrong: ["Proton", "Neutron", "Photon"] },
    { question: "What percentage of the human body is water (roughly)?", correct: "60%", wrong: ["40%", "75%", "90%"] },
    { question: "Which blood type is the universal donor?", correct: "O negative", wrong: ["AB positive", "A negative", "B positive"] },
    { question: "Which planet is known as the Red Planet?", correct: "Mars", wrong: ["Venus", "Jupiter", "Mercury"] },
    { question: "What is the chemical formula for water?", correct: "H₂O", wrong: ["CO₂", "O₂", "H₂O₂"] },
    { question: "How many legs does a spider have?", correct: "8", wrong: ["6", "10", "12"] },
    { question: "What is the closest star to Earth?", correct: "The Sun", wrong: ["Proxima Centauri", "Sirius", "Polaris"] },
    { question: "Which gas makes up most of Earth's atmosphere?", correct: "Nitrogen", wrong: ["Oxygen", "Carbon dioxide", "Hydrogen"] },
    { question: "How many chambers does the human heart have?", correct: "4", wrong: ["2", "3", "6"] },
    { question: "What is the largest animal to have ever lived?", correct: "The blue whale", wrong: ["The T-Rex", "The African elephant", "The megalodon"] },
    { question: "What is the center of an atom called?", correct: "The nucleus", wrong: ["The core", "The proton", "The electron shell"] },
    { question: "At what temperature does water boil at sea level?", correct: "100°C", wrong: ["90°C", "110°C", "120°C"] },
    { question: "What force pulls objects toward Earth?", correct: "Gravity", wrong: ["Magnetism", "Friction", "Inertia"] },
  ],
  history: [
    { question: "In what year did World War II end?", correct: "1945", wrong: ["1943", "1944", "1946"] },
    { question: "Who was the first person to walk on the Moon?", correct: "Neil Armstrong", wrong: ["Buzz Aldrin", "Yuri Gagarin", "John Glenn"] },
    { question: "Which ancient civilization built Machu Picchu?", correct: "The Inca", wrong: ["The Maya", "The Aztec", "The Olmec"] },
    { question: "The Titanic sank in which year?", correct: "1912", wrong: ["1905", "1918", "1923"] },
    { question: "Who painted the Mona Lisa?", correct: "Leonardo da Vinci", wrong: ["Michelangelo", "Raphael", "Donatello"] },
    { question: "Which empire was ruled by Julius Caesar?", correct: "Roman", wrong: ["Greek", "Ottoman", "Persian"] },
    { question: "The Great Wall of China was mainly built to defend against whom?", correct: "Northern nomads", wrong: ["Japanese pirates", "Russian tsars", "Indian kingdoms"] },
    { question: "In which year did the Berlin Wall fall?", correct: "1989", wrong: ["1985", "1991", "1993"] },
    { question: "Which country gifted the Statue of Liberty to the USA?", correct: "France", wrong: ["England", "Spain", "Italy"] },
    { question: "Who was the first President of the United States?", correct: "George Washington", wrong: ["Thomas Jefferson", "Abraham Lincoln", "John Adams"] },
    { question: "Which Egyptian queen allied with Julius Caesar and Mark Antony?", correct: "Cleopatra", wrong: ["Nefertiti", "Hatshepsut", "Isis"] },
    { question: "Which city was buried by Mount Vesuvius in 79 AD?", correct: "Pompeii", wrong: ["Athens", "Carthage", "Troy"] },
    { question: "The American Civil War was fought between the North and the...?", correct: "South", wrong: ["West", "East", "Midwest"] },
    { question: "Who is credited with inventing the practical light bulb?", correct: "Thomas Edison", wrong: ["Nikola Tesla", "Alexander Bell", "Benjamin Franklin"] },
    { question: "Which region did the Vikings come from?", correct: "Scandinavia", wrong: ["Germany", "Britain", "Russia"] },
    { question: "Which country was first to give women the right to vote?", correct: "New Zealand", wrong: ["USA", "France", "Switzerland"] },
    { question: "Who was known as the Iron Lady?", correct: "Margaret Thatcher", wrong: ["Angela Merkel", "Queen Victoria", "Indira Gandhi"] },
    { question: "The Cold War was mainly between the USA and which country?", correct: "The Soviet Union", wrong: ["China", "Germany", "Japan"] },
    { question: "Whose expedition first sailed all the way around the world?", correct: "Ferdinand Magellan", wrong: ["Christopher Columbus", "James Cook", "Vasco da Gama"] },
    { question: "Who wrote the 95 Theses that started the Reformation?", correct: "Martin Luther", wrong: ["John Calvin", "Henry VIII", "Thomas More"] },
  ],
};
