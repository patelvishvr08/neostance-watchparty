export const emojis = ["❤️", "😂", "🔥", "👏", "🤯", "🍿"];
export const time = (seconds: number) =>
  Number.isFinite(seconds)
    ? `${Math.floor(Math.max(0, seconds) / 60)}:${Math.floor(
        Math.max(0, seconds) % 60,
      )
        .toString()
        .padStart(2, "0")}`
    : "0:00";
export const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const colorFor = (str: string) =>
  ["#bc8b61", "#829985", "#8e89ac", "#ac7c82", "#7296a2"][
    str.split("").reduce((a, b) => a + b.charCodeAt(0), 0) % 5
  ];
