import type { Config } from "tailwindcss";

/**
 * 색·타이포는 src/app/globals.css 의 CSS 변수(--coral, --ink 등)로 관리합니다.
 * 캐치마이크 화면과 나머지 화면이 같은 토큰을 쓰게 하려는 의도예요.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
