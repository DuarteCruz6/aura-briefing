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

const podcastText = `(Intro music fades in and out)

Hey everyone, and welcome to your personal digest. I've got a fascinating story for you today, one that started with a simple, mysterious shadow on Google Maps and spiraled into a deep dive into geopolitics, history, and a very specific quest for proof in the Arctic.

So, imagine scrolling through Google Maps, looking at the remote, icy landscapes of the Russian Arctic. Our story's investigator saw something odd: a distinct, cross-shaped shadow on Novaya Zemlya, a vast Russian archipelago where the sun barely sets in summer and never rises in winter. This wasn't just any shadow; it was a big one, and it sparked a lot of questions. People online had theories — antenna, lighthouse, microwave tower — but the idea of it being a giant cross really grabbed attention.

Turns out, this cross-like object wasn't there in 2021 but was clearly visible by 2025. Novaya Zemlya, by the way, is a historically significant spot for Russia, even serving as a test site for nuclear weapons like the Tsar Bomba. So, the area has strategic importance.

The investigation soon uncovered a broader initiative: "The Russian Arctic Project." This isn't just a church group; it's a partnership between the Russian Orthodox Church, the Russian Geographical Society, and the Russian Armed Forces. Their mission? To plant huge Orthodox crosses across the Arctic, with similar crosses erected in places like Franz Josef Land and even on Norway's Svalbard archipelago in 2023.

Why crosses? Well, it's less about pure religion and more about a geopolitical statement. You see, the head of the Russian Orthodox Church's Arctic diocese, Bishop Iakov, has been super active, installing crosses and giving blessings, even at the North Pole itself. This kind of symbolic assertion isn't new for Russia; remember when an explorer planted a Russian titanium flag on the North Pole's ocean floor back in 2007? These crosses, sometimes even adorned with military symbols like the St. George ribbon, are a clear way to underscore Russia's claims and presence in the Arctic.

Our curious investigator was determined to prove that the Novaya Zemlya shadow was indeed one of these "Arctic Project" crosses. They tried to find the shadows of the other known crosses in Svalbard and Franz Josef Land on satellite images, which proved surprisingly difficult due to relocations — the Svalbard cross had to be moved after Norway objected! — and snow cover.

The breakthrough came with a bit of geometry and some old-fashioned detective work. By measuring the length of the mysterious shadow on Google Maps and knowing the sun's angle on that specific day and time, the height of the object was calculated to be about 7.5 meters. This was incredibly close to the reported heights of the other Arctic Project crosses — around 7 to 8 meters. And then, an environmental NGO based in Norway, the Bellona Foundation, came through with the definitive proof: a news article confirming an 8-meter tall Orthodox cross had indeed been erected on Novaya Zemlya in April 2021, commemorating an 1822 Arctic expedition.

It turned out a photograph initially misidentified as a cross in Franz Josef Land was actually a crystal-clear image of our Novaya Zemlya cross, complete with Bishop Iakov himself in attendance!

So, what's the deeper meaning behind all these crosses? A New Yorker article offered a crucial clue: the Pomors. These are an ancient Russian ethnographic group who for centuries fished and hunted in the Arctic, leaving Orthodox crosses as both navigational aids and territorial markers. Today, hundreds of years later, the Russian Orthodox Church is reviving this tradition — planting new crosses to reassert historical and sovereign claims in an increasingly contested Arctic region.`;

const podcastLines: TranscriptSegment[] = [{ id: 0, start: 0, end: 600, text: podcastText }];

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
