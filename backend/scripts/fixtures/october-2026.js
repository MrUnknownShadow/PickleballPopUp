// The sponsor's October_2026_Pickleball.pdf, typed in: used by check-stats.js and seed-october.js.

// Each sheet: the games ("Team 1 S1 S2 Team 2"), the row colours, then the Player Stats rows exactly as printed.
const SHEETS = {
  "10/1": [`
Dan & Paul 2 9 Garrett & Mike
Dan & Tom 9 8 Paul & Mike
Garrett & Tom 9 8 Dan & Ben
Garrett & Paul 11 4 Mike & Tom
Ben & Paul 9 7 Dan & Mike
Garrett & Paul 8 9 Tom & Ben
Dan & Garrett 9 4 Mike & Ben
Dan & Tom 9 4 Paul & Mike
Tom & Garrett 11 6 Paul & Mike`, "BCCBCC---", `
Garrett 5-1 83% 57 33 +24 80% 100% W2 4.3 1-1
Tom 5-1 83% 51 45 +6 100% 50% W3 3.3 3-0
Dan 3-3 50% 44 43 +1 75% 0% W2 3.5 1-2
Ben 2-2 50% 30 33 -3 100% 33% L1 2.2 2-1
Paul 2-5 29% 48 58 -10 50% 0% L3 4.0 1-2
Mike 1-6 14% 42 60 -18 0% 14% L6 4.6 0-2`],
  "10/2": [`
Dan & Chad 11 6 Tom & Paul
Paul & Chad 9 7 Dan & Tom
Dan & Paul 4 9 Tom & Garrett
Tom & Dan 2 9 Chad & Garrett
Tom & Chad 6 9 Dan & Paul`, "-C-B-", `
Garrett 2-0 100% 18 6 +12 0% 100% W2 6.0 0-0
Chad 3-1 75% 35 24 +11 67% 100% L1 4.2 1-1
Paul 2-2 50% 28 33 -5 50% 50% W1 3.8 2-0
Dan 2-3 40% 33 39 -6 33% 50% W1 4.4 1-1
Tom 1-4 20% 30 42 -12 0% 33% L2 4.4 0-2`],
  "10/5": [`
Dan & Tom 5 11 Garrett & Mathias
Tom & Garrett 5 8 Dan & Mathias
Paul & Garrett 6 9 Dan & Mathias
Dan & Paul 9 7 Mathias & Wells
Mathias & Paul 0 9 Wells & Garrett
Dan & Wells 9 2 Garrett & Tom
Paul & Mathias 9 7 Dan & Wells
Wells & Mathias 9 5 Tom & Paul`, "---CSBC-", `
Mathias 5-2 71% 53 46 +7 67% 75% W2 4.1 3-1
Dan 4-2 67% 47 40 +7 67% 67% L1 3.8 3-1
Wells 3-2 60% 41 25 +16 100% 33% W1 4.8 0-2
Garrett 2-3 40% 33 31 +2 0% 67% L1 5.6 0-2
Paul 2-3 40% 29 41 -12 50% 0% L1 4.0 2-1
Tom 0-4 0% 17 37 -20 0% 0% L4 5.0 0-1`],
  "10/6": [`
Dan & Tom 9 6 Mike & Ridge
Casey & Tom 2 9 Dan & Ridge
Dan & Mike 9 8 Garrett & Casey
Ridge & Casey 9 1 Mike & Tom
Dan & Casey 9 8 Ridge & Tom
Dan & Mike 1 9 Garrett & Ridge
Garrett & Mike 9 2 Dan & Tom
Dan & Mike 9 0 Ridge & Casey
Casey & Tom 9 6 Ridge & Mike
Tom & Garrett 14 12 Ridge & Casey`, "-BCBCBBS-C", `
Garrett 3-1 75% 40 24 +16 100% 50% W3 4.5 1-1
Dan 5-2 71% 48 42 +6 80% 50% W1 5.1 3-0
Tom 3-4 43% 45 60 -15 75% 0% W2 4.4 3-1
Mike 3-4 43% 41 46 -5 75% 0% L1 5.6 1-2
Casey 3-4 43% 49 56 -7 75% 0% L1 4.4 2-2
Ridge 3-5 38% 59 54 +5 100% 29% L3 5.1 0-4`],
  "10/7": [`
Dan & Mike 9 4 Ben & Wells
Dan & Wells 1 7 Ben & Mike
Mike & Ben 3 9 Garrett & Wells
Wells & Ben 6 9 Dan & Garrett
Wells & Ben 9 8 Dan & Mike
Dan & Mike 0 9 Garrett & Wells
Dan & Ben 7 9 Garrett & Mike
Garrett & Mike 9 5 Ben & Wells`, "----CSC-", `
Garrett 5-0 100% 45 21 +24 100% 100% W5 4.8 2-0
Mike 4-3 57% 45 44 +1 50% 67% W2 4.7 1-1
Wells 3-4 43% 43 45 -2 33% 50% L1 4.9 1-1
Dan 2-4 33% 34 44 -10 25% 50% L3 4.3 1-2
Ben 2-5 29% 41 54 -13 25% 33% L2 3.9 1-2`],
  "10/12": [`
Dan & Chad 9 7 Tom & Garrett
Dan & Wells 9 7 Chad & Tom
Cliff & Dan 4 9 Wells & Garrett
Wells & Tom 2 9 Cliff & Chad
Tom & Dan 0 9 Cliff & Garrett
Dan & Wells 2 9 Garrett & Chad
Cliff & Tom 0 9 Wells & Dan
Cliff & Garrett 9 3 Wells & Chad
Cliff & Chad 4 11 Wells & Garrett
Cliff & Wells 7 11 Chad & Garrett`, "CC-BSBS-B-", `
Garrett 6-1 86% 65 29 +36 100% 83% W6 5.7 0-1
Chad 4-3 57% 52 47 +5 50% 60% W1 5.0 1-1
Dan 3-3 50% 33 41 -8 40% 100% W1 5.7 2-0
Wells 4-4 50% 52 53 -1 25% 75% L1 5.9 1-0
Cliff 3-4 43% 42 45 -3 20% 100% L2 6.7 0-0
Tom 0-5 0% 16 45 -29 0% 0% L5 5.8 0-2`],
  "10/14": [`
Dan & Mike 11 9 Garrett & Cliff
Cliff & Garrett 11 5 Mike & Dan
Dan & Mike 6 11 Cliff & Garrett
Mike & Garrett 12 10 Dan & Cliff
Cliff & Dan 11 1 Garrett & Mike`, "C--CB", `
Garrett 3-2 60% 44 43 +1 100% 33% L1 5.0 1-1
Cliff 3-2 60% 52 35 +17 100% 33% W1 5.0 0-2
Dan 2-3 40% 43 44 -1 67% 0% W1 5.0 1-1
Mike 2-3 40% 35 52 -17 67% 0% L1 5.0 2-0`],
  "10/15": [`
Cliff & Casey 11 9 Mike & Chad
Casey & Dan 8 9 Cliff & Mike
Casey & Chad 7 9 Cliff & Dan
Casey & Mike 8 9 Dan & Chad
Casey & Cliff 5 9 Dan & Mike
Cliff & Chad 8 9 Dan & Mike
Cliff & Casey 9 4 Mike & Chad
Mike & Casey 4 11 Dan & Cliff`, "CCCC-C-B", `
Dan 5-1 83% 55 41 +14 0% 100% W5 2.7 3-1
Cliff 5-2 71% 62 50 +12 50% 100% W2 3.1 3-1
Mike 3-4 43% 52 61 -9 0% 60% L2 3.0 2-2
Casey 2-5 29% 52 60 -8 29% 0% L1 3.1 1-3
Chad 1-4 20% 37 46 -9 0% 33% L2 2.2 1-3`],
  "10/16": [`
Dan & Wells 11 7 Ridge & Cliff
Cliff & Dan 9 6 Bev & Ben
Wells & Ridge 9 0 Bev & Ben
Wells & Cliff 5 9 Dan & Ridge
Dan & Cliff 8 9 Bev & Ben
Wells & Ridge 7 9 Bev & Ben
Cliff & Ridge 3 9 Dan & Wells
Ben & Dan 9 8 Cliff & Bev
Wells & Ben 9 8 Bev & Ridge
Cliff & Dan 9 6 Ridge & Wells
Cliff & Ben 3 9 Dan & Bev
Cliff & Ridge 10 12 Ben & Bev`, "--S-CC-CC--C", `
Dan 7-1 88% 73 47 +26 80% 100% W4 3.5 3-1
Ben 5-3 62% 57 68 -11 67% 60% W1 3.1 5-1
Wells 4-3 57% 56 45 +11 60% 50% L1 4.1 1-2
Bev 4-4 50% 61 64 -3 0% 50% W2 3.1 3-3
Ridge 2-6 25% 59 64 -5 25% 25% L5 3.9 0-4
Cliff 2-7 22% 62 80 -18 29% 0% L2 3.3 2-3`],
  "10/19": [`
Chad & Tom 6 9 Dan & Mathias
Cliff & Mathias 4 9 Dan & Wells
Tom & Wells 3 9 Chad & Cliff
Mathias & Chad 9 7 Dan & Tom
Cliff & Dan 4 9 Wells & Mathias
Cliff & Tom 3 9 Chad & Wells
Tom & Mathias 9 5 Chad & Dan
Dan & Wells 4 9 Cliff & Mathias
Cliff & Wells 4 9 Tom & Dan
Wells & Mathias 1 11 Cliff & Chad
Cliff & Chad 11 5 Wells & Mathias`, "---C-----B-", `
Chad 5-2 71% 60 37 +23 67% 75% W2 5.3 1-1
Mathias 5-3 62% 55 57 -2 50% 75% L2 5.0 2-0
Cliff 4-4 50% 55 49 +6 20% 100% W2 6.0 0-0
Dan 3-4 43% 47 50 -3 0% 60% W1 4.1 1-1
Wells 3-5 38% 44 60 -16 0% 75% L4 6.0 0-0
Tom 2-4 33% 37 45 -8 25% 50% W2 4.3 0-2`],
  "10/20": [`
Cliff & Pete 3 9 Dan & Casey
Tom & Casey 3 9 Dan & Ridge
Tom & Pete 9 6 Cliff & Ridge
Cliff & Casey 7 9 Dan & Pete
Dan & Tom 8 9 Casey & Ridge
Tom & Cliff 5 9 Ridge & Pete
Pete & Casey 9 5 Cliff & Dan
Ridge & Casey 9 5 Dan & Tom
Cliff & Dan 9 5 Ridge & Pete
Ridge & Pete 6 11 Cliff & Casey
Cliff & Casey 11 13 Ridge & Pete
Ridge & Pete 11 8 Cliff & Casey`, "---CC-----C-", `
Pete 6-3 67% 74 71 +3 60% 75% W2 3.7 4-0
Ridge 6-3 67% 77 69 +8 67% 67% W2 3.6 3-1
Dan 4-3 57% 54 45 +9 50% 60% W1 3.9 1-1
Casey 5-4 56% 76 69 +7 40% 75% L2 3.7 1-3
Cliff 2-7 22% 65 80 -15 20% 25% L2 3.7 0-4
Tom 1-4 20% 30 42 -12 25% 0% L3 3.6 1-1`],
  "10/21": [`
Tom & Mike 2 9 Cliff & Garrett
Tom & Dan 2 9 Cliff & Mike
Garrett & Wells 9 0 Cliff & Mike
Dan & Wells 7 9 Garrett & Tom
Cliff & Tom 0 9 Mike & Dan
Cliff & Dan 9 2 Wells & Mike
Dan & Wells 4 9 Garrett & Mike
Garrett & Wells 9 6 Cliff & Dan
Cliff & Wells 4 9 Dan & Mike
Cliff & Garrett 9 0 Mike & Wells
Cliff & Wells 6 9 Tom & Mike
Tom & Mike 11 7 Wells & Cliff`, "BBSCSB---S--", `
Garrett 6-0 100% 54 19 +35 100% 100% W6 5.8 2-0
Mike 6-4 60% 60 59 +1 50% 62% W2 6.5 1-0
Tom 3-3 50% 33 47 -14 25% 100% W2 5.3 2-0
Dan 3-4 43% 46 42 +4 25% 67% W1 5.4 0-2
Cliff 4-6 40% 59 62 -3 40% 40% L2 6.3 0-2
Wells 2-7 22% 48 71 -23 33% 0% L4 5.2 1-2`],
  "10/22": [`
Cliff & Dan 4 9 Mike & Chad
Chad & Tom 7 9 Mike & Dan
Dan & Mike 3 9 Cliff & Garrett
Cliff & Tom 3 9 Chad & Garrett
Chad & Mike 4 9 Dan & Tom
Garrett & Mike 6 9 Dan & Cliff
Chad & Cliff 5 9 Dan & Tom
Garrett & Chad 9 2 Tom & Mike
Cliff & Mike 8 11 Dan & Chad
Cliff & Tom 3 11 Dan & Mike
Cliff & Chad 15 13 Mike & Tom`, "-C-----B-BC", `
Dan 6-2 75% 65 51 +14 0% 100% W5 4.5 3-0
Garrett 3-1 75% 33 17 +16 50% 100% W1 5.5 0-1
Chad 5-3 62% 69 57 +12 40% 100% W3 4.2 2-1
Cliff 3-5 38% 56 71 -15 17% 100% W1 4.6 2-1
Mike 3-6 33% 65 76 -11 0% 60% L1 4.6 1-3
Tom 2-5 29% 46 62 -16 0% 50% L3 4.9 0-2`],
  "10/23 (Sheet 1)": [`
Tom & Dan 8 9 Cliff & Ridge
Cliff & Austin 5 9 Dan & Ridge
Cliff & Dan 9 5 Austin & Tom
Wells & Austin 6 9 Ben & Ridge
Cliff & Dan 9 6 Tom & Ridge
Ridge & Austin 9 0 Ben & Wells
Ben & Cliff 7 9 Dan & Wells
Tom & Wells 4 9 Austin & Ridge
Cliff & Dan 7 9 Ben & Austin
Ben & Wells 9 1 Dan & Ridge
Cliff & Tom 8 9 Wells & Austin
Cliff & Ridge 4 9 Ben & Dan`, "C----SC-CBC-", `
Ben 4-2 67% 43 36 +7 50% 75% W3 4.8 2-1
Dan 5-3 62% 61 54 +7 50% 75% W1 3.6 2-2
Ridge 5-3 62% 56 50 +6 50% 67% L2 4.8 2-1
Austin 4-3 57% 52 46 +6 33% 75% W4 4.0 2-1
Wells 3-3 50% 37 43 -6 33% 67% W2 4.7 2-1
Cliff 3-5 38% 58 64 -6 29% 100% L4 2.8 2-3
Tom 0-5 0% 31 45 -14 0% 0% L5 2.8 0-3`],
  "10/23 (Sheet 2)": [`
Ben & Tom 9 5 Ridge & Wells
Ben & Cliff 8 9 Dan & Austin
Cliff & Wells 5 11 Dan & Tom
Dan & Tom 11 7 Cliff & Wells
Tom & Cliff 7 11 Wells & Dan`, "-C---", `
Dan 4-0 100% 42 27 +15 100% 100% W4 3.8 1-0
Austin 1-0 100% 9 8 +1 0% 100% W1 1.0 1-0
Tom 3-1 75% 38 28 +10 67% 100% L1 4.5 0-0
Ben 1-1 50% 17 14 +3 50% 0% L1 2.5 0-1
Wells 1-3 25% 28 38 -10 0% 33% W1 4.5 0-0
Cliff 0-4 0% 27 42 -15 0% 0% L4 3.8 0-1
Ridge 0-1 0% 5 9 -4 0% 0% L1 4.0 0-0`],
  "10/26": [`
Cliff & Tom 6 9 Mike & Dan
Mike & Mathias 9 2 Dan & Wells
Wells & Cliff 7 9 Tom & Mathias
Dan & Cliff 9 6 Wells & Mike
Tom & Mike 0 9 Dan & Mathias
Tom & Wells 9 4 Cliff & Mathias
Dan & Wells 0 9 Cliff & Mike
Mike & Mathias 9 5 Dan & Tom
Tom & Cliff 9 8 Wells & Mathias`, "-BC-S-S-C", `
Mike 4-2 67% 42 31 +11 67% 67% W2 5.8 1-1
Mathias 4-2 67% 48 32 +16 100% 50% L1 4.7 1-1
Cliff 3-3 50% 44 41 +3 50% 50% W2 3.8 2-2
Tom 3-3 50% 38 46 -8 50% 50% W1 4.0 2-1
Dan 3-3 50% 34 39 -5 50% 50% L2 5.8 2-0
Wells 1-5 17% 32 49 -17 33% 0% L2 4.5 0-3`],
  "10/28": [`
Dan & Tom 2 9 Casey & Mike
Cliff & Casey 2 9 Mike & Dan
Cliff & Dan 9 8 Casey & Tom
Wells & Tom 0 9 Mike & Chad
Cliff & Chad 9 7 Dan & Casey
Tom & Dan 7 9 Wells & Mike
Casey & Chad 3 9 Cliff & Wells
Casey & Mike 5 9 Dan & Chad
Mike & Wells 9 4 Cliff & Tom
Cliff & Casey 9 2 Chad & Wells
Cliff & Mike 10 12 Wells & Casey
Wells & Casey 3 11 Cliff & Mike`, "BBCSCC---BCB", `
Mike 6-2 75% 71 39 +32 33% 100% W1 5.5 1-1
Cliff 5-3 62% 63 53 +10 60% 67% W1 4.8 2-1
Chad 3-2 60% 32 30 +2 50% 67% L1 5.6 1-0
Wells 4-3 57% 44 53 -9 33% 75% L1 5.6 2-0
Dan 3-3 50% 43 42 +1 33% 67% W1 3.8 1-2
Casey 3-6 33% 58 70 -12 20% 50% L1 4.9 1-2
Tom 0-5 0% 21 45 -24 0% 0% L5 4.8 0-2`],
  "10/29": [`
Casey & Garrett 9 5 Dan & Cliff
Cliff & Casey 2 9 Dan & Chad
Chad & Garrett 9 6 Casey & Dan
Cliff & Chad 2 9 Dan & Casey
Cliff & Chad 8 9 Dan & Garrett
Casey & Chad 8 11 Cliff & Garrett`, "-B-BC-", `
Garrett 4-0 100% 38 27 +11 100% 100% W4 2.8 3-0
Dan 3-2 60% 38 30 +8 0% 60% W2 4.4 1-1
Casey 2-3 40% 34 36 -2 33% 50% L1 4.8 0-2
Chad 2-3 40% 36 37 -1 25% 100% L3 4.2 1-2
Cliff 1-4 20% 28 44 -16 0% 50% W1 4.4 1-1`],
};

// October 2026 — Combined Summary: Player W-L Win% PF AvgF PA AvgA +/- Srv% Rcv% Streak AvgMgn Close
const MONTH = `
Garrett 39-9 81% 427 8.9 250 5.2 +177 80% 82% W5 5.0 10-7
Mathias 14-7 67% 156 7.4 135 6.4 +21 67% 67% L1 4.6 6-2
Pete 6-3 67% 74 8.2 71 7.9 +3 60% 75% W2 3.7 4-0
Austin 5-3 62% 61 7.6 54 6.8 +7 33% 80% W5 3.6 3-1
Dan 67-46 59% 840 7.4 761 6.7 +79 49% 68% W2 4.3 30-18
Chad 23-18 56% 321 7.8 278 6.8 +43 43% 70% L3 4.5 8-9
Ben 14-13 52% 188 7.0 205 7.6 -17 50% 53% L1 3.5 10-6
Bev 4-4 50% 61 7.6 64 8.0 -3 0% 50% W2 3.1 3-3
Mike 32-34 48% 453 6.9 468 7.1 -15 44% 51% W1 5.1 10-12
Ridge 16-18 47% 256 7.5 246 7.2 +10 50% 46% L3 4.3 5-10
Wells 28-39 42% 425 6.3 482 7.2 -57 35% 48% L1 5.1 8-11
Casey 15-22 41% 269 7.3 291 7.9 -22 38% 46% L1 4.2 5-12
Cliff 38-56 40% 673 7.2 716 7.6 -43 31% 58% W1 4.5 14-21
Paul 6-10 38% 105 6.6 132 8.2 -27 50% 17% L1 3.9 5-3
Tom 23-48 32% 433 6.1 589 8.3 -156 33% 32% L5 4.4 11-17`;

module.exports = { SHEETS, MONTH };
