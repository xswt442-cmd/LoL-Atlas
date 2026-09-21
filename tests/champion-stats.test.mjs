import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  attackSpeedAtLevel,
  bonusAttackSpeedPercent,
  growthFactor,
  LEVEL_SCALED_STATS,
  MAX_LEVEL,
  MIN_LEVEL,
  statAtLevel,
  valueAtLevel,
} from "../lib/champion-stats.mjs";

// 升级曲线是递增的：1 级只有基础值，之后每级涨得越来越多。
// 这两个累计值是官方曲线的两个已知点（18 级正好是 17，20 级 19.665），
// 一旦有人把公式改成线性，它们会立刻炸。
test("成长倍率：1 级为 0，18 级正好 17，20 级 19.665", () => {
  assert.equal(growthFactor(0), 0);
  assert.equal(growthFactor(1), 0);
  assert.equal(Number(growthFactor(18).toFixed(4)), 17);
  assert.equal(Number(growthFactor(20).toFixed(4)), 19.665);
});

test("成长倍率是递增曲线，不是线性", () => {
  // 线性的话每级增量固定；递增曲线里第 19→20 级的增量必须大于第 1→2 级
  const firstStep = statAtLevel(0, 1, 2) - statAtLevel(0, 1, 1);
  const lastStep = statAtLevel(0, 1, MAX_LEVEL) - statAtLevel(0, 1, MAX_LEVEL - 1);

  assert.ok(firstStep > 0);
  assert.ok(lastStep > firstStep * 1.4, `末级增量 ${lastStep} 应明显大于首级 ${firstStep}`);
});

test("1 级永远等于基础值，成长值不影响它", () => {
  assert.equal(statAtLevel(645, 108, 1), 645);
  assert.equal(statAtLevel(0, 0, 1), 0);
});

// 参考值：lolwiki 的盲僧「Base statistics」表（等级上限 20）。
// 前半段顺带把数据本身钉住 —— 若某个版本改了盲僧的基础值，这里会失败，
// 那时应当核对新数值后更新本测试，而不是改公式。
test("盲僧：基础值与成长值仍是 16.18.1 的那一套", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/lol.json", import.meta.url), "utf8"));
  const lee = data.champions.find((champion) => champion.id === "LeeSin");

  assert.equal(lee.hp, 645);
  assert.equal(lee.hp_per_level, 108);
  assert.equal(lee.hpregen, 7.5);
  assert.equal(lee.hpregen_per_level, 0.7);
  assert.equal(lee.armor, 36);
  assert.equal(lee.armor_per_level, 4.5);
  assert.equal(lee.spellblock, 32);
  assert.equal(lee.spellblock_per_level, 2.05);
  assert.equal(lee.attackdamage, 66);
  assert.equal(lee.attackdamage_per_level, 3.4);
  assert.equal(lee.attackspeed, 0.651);
  assert.equal(lee.attackspeed_per_level, 3);
});

test("盲僧 20 级的各项数值与 lolwiki 逐项一致", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/lol.json", import.meta.url), "utf8"));
  const lee = data.champions.find((champion) => champion.id === "LeeSin");
  const at = (base, growth) => Number(statAtLevel(lee[base], lee[growth], 20).toFixed(2));

  assert.equal(at("hp", "hp_per_level"), 2768.82);
  assert.equal(at("hpregen", "hpregen_per_level"), 21.27);
  assert.equal(at("armor", "armor_per_level"), 124.49);
  assert.equal(at("spellblock", "spellblock_per_level"), 72.31);
  assert.equal(at("attackdamage", "attackdamage_per_level"), 132.86);
  // 截图写的是「Bonus AS 0–59%」，即成长带来的额外攻速
  assert.equal(Number(bonusAttackSpeedPercent(lee.attackspeed_per_level, 20).toFixed(1)), 59);
});

test("攻速：比率等于基础攻速时，等价于「基础攻速 ×(1+额外攻速)」", () => {
  const base = 0.651;
  const growth = 3;
  const viaRatio = attackSpeedAtLevel(base, base, growth, 20);
  const direct = base * (1 + bonusAttackSpeedPercent(growth, 20) / 100);

  assert.ok(Math.abs(viaRatio - direct) < 1e-12, `${viaRatio} vs ${direct}`);
});

test("攻速：比率与基础攻速不同时，以比率为缩放基准", () => {
  // 赛娜：基础攻速 0.625、比率 0.4，同样的成长只按 0.4 缩放（这是"攻速比率"的含义）
  const senna = attackSpeedAtLevel(0.625, 0.4, 2.6, 20);
  const naive = attackSpeedAtLevel(0.625, 0.625, 2.6, 20);

  assert.ok(senna < naive);
  assert.ok(Math.abs(senna - (0.625 + 0.4 * 0.026 * growthFactor(20))) < 1e-12);
});

test("取值的描述符：linear / attackspeed / fixed 三种各走各的", () => {
  const champion = {
    hp: 645, hp_per_level: 108,
    attackspeed: 0.651, attackspeed_per_level: 3, attackspeed_ratio: 0.651,
    movespeed: 345,
  };

  assert.equal(valueAtLevel(champion, { base: "hp", growth: "hp_per_level", kind: "linear" }, 20), statAtLevel(645, 108, 20));
  assert.equal(valueAtLevel(champion, { base: "movespeed", kind: "fixed" }, 20), 345);
  assert.equal(
    valueAtLevel(champion, { base: "attackspeed", growth: "attackspeed_per_level", ratio: "attackspeed_ratio", kind: "attackspeed" }, 20),
    attackSpeedAtLevel(0.651, 0.651, 3, 20),
  );
});

test("取值的描述符：字段缺失返回 null，而不是 NaN", () => {
  assert.equal(valueAtLevel({}, { base: "mp", growth: "mp_per_level", kind: "linear" }, 10), null);
  // 成长字段缺失按 0 处理（赛娜的 AD 成长就是这种情况）
  assert.equal(valueAtLevel({ hp: 600 }, { base: "hp", growth: "hp_per_level", kind: "linear" }, 10), 600);
});

// 面板会把 173 个英雄 × 20 个等级 × 每个属性都算一遍并格式化。
// 最容易出的运行时事故就是某个字段缺失算出 NaN 然后渲染成 "NaN"，
// 这条把整张表扫一遍。
test("全量数据：所有英雄 × 所有等级都能算出有限数值", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/lol.json", import.meta.url), "utf8"));
  const broken = [];

  for (const champion of data.champions) {
    for (const descriptor of LEVEL_SCALED_STATS) {
      for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += 1) {
        const value = valueAtLevel(champion, descriptor, level);
        if (value === null) continue;
        if (!Number.isFinite(value)) {
          broken.push(`${champion.id} ${descriptor.key} @${level} = ${value}`);
        }
      }
    }
  }

  assert.deepEqual(broken.slice(0, 5), []);
});

test("全量数据：成长值非负，且等级越高数值不会倒退", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data/lol.json", import.meta.url), "utf8"));
  const problems = [];

  for (const champion of data.champions) {
    for (const descriptor of LEVEL_SCALED_STATS) {
      let previous = -Infinity;
      for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += 1) {
        const value = valueAtLevel(champion, descriptor, level);
        if (value === null) continue;
        if (value < previous - 1e-9) problems.push(`${champion.id} ${descriptor.key} @${level} 比上一级还小`);
        previous = value;
      }
    }
  }

  assert.deepEqual(problems.slice(0, 5), []);
});
