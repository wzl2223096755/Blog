import type { ProfileConfig } from "../types/config";

export const profileConfig: ProfileConfig = {
	avatar: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=200",
	name: "王忠亮",
	bio: "软件工程本科生 · 全栈开发学习者",
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/wzl2223096755",
			showName: false,
		},
		{
			name: "Email",
			icon: "fa7-solid:envelope",
			url: "mailto:wzl2223096755@gmail.com",
			showName: false,
		},
		{
			name: "RSS",
			icon: "fa7-solid:rss",
			url: "/rss/",
			showName: false,
		},
	],
};
