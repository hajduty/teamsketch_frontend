export const getTransformedPointer = (stage: any) => {
  const scale = stage.scaleX();
  const position = stage.position();
  const pointer = stage.getPointerPosition();

  return {
    x: (pointer.x - position.x) / scale,
    y: (pointer.y - position.y) / scale
  };
};

export const generateHistoryId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export function generateRoomId(): string {
  const firstWords = [
    "Silent", "Broken", "Lonely", "Spicy", "Electric",
    "Crimson", "Wicked", "Golden", "Fuzzy", "Frozen",
    "Hidden", "Lazy", "Noisy", "Tiny", "Glowing",
    "Wild", "Sleepy", "Ancient", "Dusty", "Brave"
  ];

  const secondWords = [
    "Dream", "River", "Moon", "Storm", "Machine",
    "Keyboard", "Shadow", "Promise", "Galaxy", "Potion",
    "Leaf", "Hammer", "Secret", "Cloud", "Temple",
    "Mirror", "Memory", "Forest", "Voice", "Journey"
  ];

  const first = firstWords[Math.floor(Math.random() * firstWords.length)];
  const second = secondWords[Math.floor(Math.random() * secondWords.length)];
  const number = Math.floor(1000 + Math.random() * 9000);
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();

  return `${first}-${second}-${number}${suffix}`;
}