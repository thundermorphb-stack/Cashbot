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
  ],
};
