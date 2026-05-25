export type ChatMessage = {
	id: string;
	sender: string;
	ciphertext: string;
	iv: string;
	timestamp: string;
};

export type Message =
	| {
			type: "add";
			id: string;
			sender: string;
			ciphertext: string;
			iv: string;
			timestamp: string;
	  }
	| {
			type: "all";
			messages: ChatMessage[];
	  };

export const names = [
	"Alice",
	"Bob",
	"Charlie",
	"David",
	"Eve",
	"Frank",
	"Grace",
	"Heidi",
	"Ivan",
	"Judy",
	"Kevin",
	"Linda",
	"Mallory",
	"Nancy",
	"Oscar",
	"Peggy",
	"Quentin",
	"Randy",
	"Steve",
	"Trent",
	"Ursula",
	"Victor",
	"Walter",
	"Xavier",
	"Yvonne",
	"Zoe",
];
