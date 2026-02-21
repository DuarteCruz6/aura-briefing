export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TrackTranscript {
  trackTitle: string;
  segments: TranscriptSegment[];
}

const OFFSET = -2; // shift all timestamps 2 seconds earlier

const rawLines: Omit<TranscriptSegment, "id">[] = [
  { start: 0, end: 4, text: "♪ Intro music ♪" },
  { start: 4, end: 9, text: "Hey everyone, and welcome to your personal digest." },
  { start: 9, end: 15, text: "I've got a fascinating story for you today," },
  { start: 15, end: 21, text: "one that started with a simple, mysterious shadow on Google Maps" },
  { start: 21, end: 28, text: "and spiraled into a deep dive into geopolitics, history, and a very specific quest for proof in the Arctic." },
  { start: 28, end: 34, text: "So, imagine scrolling through Google Maps," },
  { start: 34, end: 39, text: "looking at the remote, icy landscapes of the Russian Arctic." },
  { start: 39, end: 46, text: "Our story's investigator saw something odd:" },
  { start: 46, end: 52, text: "a distinct, cross-shaped shadow on Novaya Zemlya," },
  { start: 52, end: 58, text: "a vast Russian archipelago where the sun barely sets in summer" },
  { start: 58, end: 63, text: "and never rises in winter." },
  { start: 63, end: 68, text: "This wasn't just any shadow; it was a big one," },
  { start: 68, end: 74, text: "and it sparked a lot of questions." },
  { start: 74, end: 80, text: "People online had theories — antenna, lighthouse, microwave tower —" },
  { start: 80, end: 86, text: "but the idea of it being a giant cross really grabbed attention." },
  { start: 86, end: 93, text: "Turns out, this cross-like object wasn't there in 2021" },
  { start: 93, end: 99, text: "but was clearly visible by 2025." },
  { start: 99, end: 106, text: "Novaya Zemlya, by the way, is a historically significant spot for Russia," },
  { start: 106, end: 113, text: "even serving as a test site for nuclear weapons like the Tsar Bomba." },
  { start: 113, end: 118, text: "So, the area has strategic importance." },
  { start: 118, end: 125, text: "The investigation soon uncovered a broader initiative:" },
  { start: 125, end: 132, text: "\"The Russian Arctic Project.\"" },
  { start: 132, end: 140, text: "This isn't just a church group; it's a partnership between" },
  { start: 140, end: 148, text: "the Russian Orthodox Church, the Russian Geographical Society, and the Russian Armed Forces." },
  { start: 148, end: 156, text: "Their mission? To plant huge Orthodox crosses across the Arctic," },
  { start: 156, end: 165, text: "with similar crosses erected in places like Franz Josef Land" },
  { start: 165, end: 172, text: "and even on Norway's Svalbard archipelago in 2023." },
  { start: 172, end: 179, text: "Why crosses? Well, it's less about pure religion" },
  { start: 179, end: 186, text: "and more about a geopolitical statement." },
  { start: 186, end: 195, text: "The head of the Russian Orthodox Church's Arctic diocese, Bishop Iakov," },
  { start: 195, end: 204, text: "has been super active, installing crosses and giving blessings," },
  { start: 204, end: 210, text: "even at the North Pole itself." },
  { start: 210, end: 220, text: "This kind of symbolic assertion isn't new for Russia;" },
  { start: 220, end: 230, text: "remember when an explorer planted a Russian titanium flag on the North Pole's ocean floor back in 2007?" },
  { start: 230, end: 240, text: "These crosses, sometimes even adorned with military symbols like the St. George ribbon," },
  { start: 240, end: 250, text: "are a clear way to underscore Russia's claims and presence in the Arctic." },
  { start: 250, end: 260, text: "Our curious investigator was determined to prove" },
  { start: 260, end: 270, text: "that the Novaya Zemlya shadow was indeed one of these \"Arctic Project\" crosses." },
  { start: 270, end: 280, text: "They tried to find the shadows of the other known crosses in Svalbard and Franz Josef Land" },
  { start: 280, end: 290, text: "on satellite images, which proved surprisingly difficult" },
  { start: 290, end: 298, text: "due to relocations — the Svalbard cross had to be moved after Norway objected! — and snow cover." },
  { start: 298, end: 308, text: "The breakthrough came with a bit of geometry and some old-fashioned detective work." },
  { start: 308, end: 318, text: "By measuring the length of the mysterious shadow on Google Maps" },
  { start: 318, end: 328, text: "and knowing the sun's angle on that specific day and time," },
  { start: 328, end: 338, text: "the height of the object was calculated to be about 7.5 meters." },
  { start: 338, end: 348, text: "This was incredibly close to the reported heights of the other Arctic Project crosses — around 7 to 8 meters." },
  { start: 348, end: 360, text: "And then, an environmental NGO based in Norway, the Bellona Foundation," },
  { start: 360, end: 372, text: "came through with the definitive proof:" },
  { start: 372, end: 385, text: "a news article confirming an 8-meter tall Orthodox cross had indeed been erected on Novaya Zemlya in April 2021," },
  { start: 385, end: 395, text: "commemorating an 1822 Arctic expedition." },
  { start: 395, end: 408, text: "It turned out a photograph initially misidentified as a cross in Franz Josef Land" },
  { start: 408, end: 420, text: "was actually a crystal-clear image of our Novaya Zemlya cross," },
  { start: 420, end: 430, text: "complete with Bishop Iakov himself in attendance!" },
  { start: 430, end: 442, text: "So, what's the deeper meaning behind all these crosses?" },
  { start: 442, end: 455, text: "A New Yorker article offered a crucial clue: the Pomors." },
  { start: 455, end: 468, text: "These are an ancient Russian ethnographic group" },
  { start: 468, end: 480, text: "who for centuries fished and hunted in the Arctic," },
  { start: 480, end: 495, text: "leaving Orthodox crosses as both navigational aids and territorial markers." },
  { start: 495, end: 510, text: "Today, hundreds of years later, the Russian Orthodox Church" },
  { start: 510, end: 530, text: "is reviving this tradition — planting new crosses to reassert historical and sovereign claims" },
  { start: 530, end: 545, text: "in an increasingly contested Arctic region." },
];

const podcastLines: TranscriptSegment[] = rawLines.map((line, i) => ({
  id: i,
  start: Math.max(0, line.start + OFFSET),
  end: Math.max(0, line.end + OFFSET),
  text: line.text,
}));

export const transcripts: TrackTranscript[] = [
  { trackTitle: "Daily Briefing", segments: podcastLines },
  { trackTitle: "Today's Briefing", segments: podcastLines },
  { trackTitle: "This Week's Briefing", segments: podcastLines },
  { trackTitle: "This Month's Briefing", segments: podcastLines },
];

export function getTranscriptForTrack(title: string): TranscriptSegment[] | null {
  const t = transcripts.find((tr) => tr.trackTitle === title);
  return t ? t.segments : null;
}
