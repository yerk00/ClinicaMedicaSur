// web/lib/greetings.ts
export function getGreetingParts(): { greeting: string; emoji: string } {
  const hour = new Date().getHours();
  const base = "Ficha Clínica de";
  if (hour < 12) return { greeting: base, emoji: "☀️" };
  if (hour < 18) return { greeting: base, emoji: "⛅" };
  return { greeting: base, emoji: "🌙" };
}
