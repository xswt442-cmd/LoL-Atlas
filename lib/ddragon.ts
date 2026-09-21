/**
 * ddragon 静态资源地址。
 *
 * 前缀以前散在三处（详情页一个常量、符文页两处内联字符串），增减 CDN 版本或换域名时
 * 要一起改。统一放这里，组件只负责拼业务参数。
 */

const BASE = "https://ddragon.leagueoflegends.com/cdn";

/** 英雄原画（登录界面同款大图），`num` 为 0 表示默认皮肤 */
export const championSplashUrl = (id: string, num = 0) => `${BASE}/img/champion/splash/${id}_${num}.jpg`;

/** 皮肤读取界面图，体积比原画小，皮肤格用这个 */
export const championLoadingUrl = (id: string, num: number) => `${BASE}/img/champion/loading/${id}_${num}.jpg`;

/** 符文 / 符文树的图标，数据里给的是相对路径 */
export const runeIconUrl = (icon: string) => `${BASE}/img/${icon}`;
