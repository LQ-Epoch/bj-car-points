"use client";

import { useMemo, useState } from "react";

type MemberRole = "main" | "spouse" | "other";
type MemberRelation = "self" | "spouse" | "parent" | "child" | "other";
type IndicatorType = "newEnergy" | "ordinary";
type Half = "H1" | "H2";

type Member = {
  id: number;
  role: MemberRole;
  relation: MemberRelation;
  name: string;
  ordinaryStartYear: number | null;
  ordinaryStartHalf: Half;
  newEnergyStartYear: number | null;
};

type HistoryPoint = {
  year: number;
  point: number | null;
};

const START_YEAR = 2011;
const nowYear = new Date().getUTCFullYear();

function relationLabel(relation: MemberRelation) {
  if (relation === "self") return "本人";
  if (relation === "spouse") return "配偶";
  if (relation === "parent") return "父母";
  if (relation === "child") return "子女";
  return "其他";
}

function roleLabel(role: MemberRole) {
  if (role === "main") return "主申请人";
  if (role === "spouse") return "配偶";
  return "其他成员";
}

function basePoint(role: MemberRole) {
  return role === "main" ? 2 : 1;
}

function calcYears(startYear: number | null, statYear: number) {
  if (!startYear || startYear > statYear) return 0;
  return statYear - startYear + 1;
}

function calcOrdinaryRounds(startYear: number | null, half: Half, statYear: number) {
  if (!startYear || startYear > statYear) return 0;
  const fullYearsAfter = Math.max(0, statYear - startYear);
  const firstYearRounds = half === "H1" ? 6 : 3;
  return firstYearRounds + fullYearsAfter * 6;
}

function calcOrdinaryStep(rounds: number) {
  if (rounds <= 0) return 0;
  return 1 + Math.floor((rounds - 1) / 24);
}

function toYearOptions(statYear: number) {
  return Array.from({ length: statYear - START_YEAR + 1 }, (_, i) => START_YEAR + i);
}

function createMember(id: number, relation: MemberRelation, role: MemberRole, name: string): Member {
  return {
    id,
    relation,
    role,
    name,
    ordinaryStartYear: null,
    ordinaryStartHalf: "H1",
    newEnergyStartYear: null,
  };
}

function createDefaultMembers() {
  return [
    createMember(1, "self", "main", "主申请人"),
    createMember(2, "spouse", "spouse", "配偶"),
  ];
}

function linearPredict(history: HistoryPoint[], nextYears: number[]) {
  const valid = history.filter((h) => h.point !== null) as Array<{ year: number; point: number }>;
  if (valid.length < 2) return nextYears.map((year) => ({ year, point: null as number | null }));

  const n = valid.length;
  const sumX = valid.reduce((s, v) => s + v.year, 0);
  const sumY = valid.reduce((s, v) => s + v.point, 0);
  const sumXY = valid.reduce((s, v) => s + v.year * v.point, 0);
  const sumX2 = valid.reduce((s, v) => s + v.year * v.year, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return nextYears.map((year) => ({ year, point: null as number | null }));

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return nextYears.map((year) => {
    const value = Math.round((intercept + slope * year) * 10) / 10;
    return { year, point: value < 0 ? 0 : value };
  });
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [indicatorType, setIndicatorType] = useState<IndicatorType>("newEnergy");
  const [ordinaryBatch, setOrdinaryBatch] = useState<Half>("H1");

  const [statYear, setStatYear] = useState(nowYear);
  const [familyApplyStartYear, setFamilyApplyStartYear] = useState<number | null>(null);
  const [generations, setGenerations] = useState(2);
  const [includeSpouse, setIncludeSpouse] = useState(true);
  const [members, setMembers] = useState<Member[]>(createDefaultMembers());

  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([
    { year: nowYear - 4, point: null },
    { year: nowYear - 3, point: null },
    { year: nowYear - 2, point: null },
    { year: nowYear - 1, point: null },
    { year: nowYear, point: null },
  ]);

  const yearOptions = useMemo(() => toYearOptions(statYear), [statYear]);
  const visibleMembers = useMemo(
    () => members.filter((m) => includeSpouse || m.role !== "spouse"),
    [members, includeSpouse]
  );
  const familyApplyYears = calcYears(familyApplyStartYear, statYear);

  const deadlineText =
    indicatorType === "newEnergy"
      ? `${statYear} 年家庭新能源指标申请截止：${statYear}-03-08 24:00（以当年公告为准）`
      : ordinaryBatch === "H1"
      ? `${statYear} 年油牌（普通指标）上半年申请截止：${statYear}-03-08 24:00（以当年公告为准）`
      : `${statYear} 年油牌（普通指标）下半年申请截止：${statYear}-10-08 24:00（以当年公告为准）`;

  const result = useMemo(() => {
    const main = visibleMembers.find((m) => m.role === "main");
    const spouse = visibleMembers.find((m) => m.role === "spouse");

    if (!main) {
      return { ok: false, message: "至少需要 1 位主申请人。", total: 0, formulaText: "", detail: [] as any[] };
    }
    if (includeSpouse && !spouse) {
      return {
        ok: false,
        message: "你选择了包含配偶，但当前没有配偶成员。",
        total: 0,
        formulaText: "",
        detail: [] as any[],
      };
    }

    const detail = visibleMembers.map((m) => {
      const rounds = calcOrdinaryRounds(m.ordinaryStartYear, m.ordinaryStartHalf, statYear);
      const ordinaryStep = calcOrdinaryStep(rounds);
      const newEnergyYears = calcYears(m.newEnergyStartYear, statYear);
      const base = basePoint(m.role);
      const point = base + ordinaryStep + newEnergyYears + familyApplyYears;
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        relation: m.relation,
        base,
        rounds,
        ordinaryStep,
        newEnergyYears,
        familyYears: familyApplyYears,
        point,
      };
    });

    const mainPoint = detail.find((d) => d.role === "main")?.point ?? 0;
    const spousePoint = detail.find((d) => d.role === "spouse")?.point ?? 0;
    const othersPoint = detail
      .filter((d) => d.role === "other")
      .reduce((sum, d) => sum + d.point, 0);

    const total = includeSpouse
      ? ((mainPoint + spousePoint) * 2 + othersPoint) * generations
      : (mainPoint + othersPoint) * generations;

    const formulaText = includeSpouse
      ? `总积分 = [(${mainPoint} + ${spousePoint}) × 2 + ${othersPoint}] × ${generations}`
      : `总积分 = (${mainPoint} + ${othersPoint}) × ${generations}`;

    return { ok: true, message: "", total, formulaText, detail };
  }, [visibleMembers, includeSpouse, generations, familyApplyYears, statYear]);

  const prediction = useMemo(
    () =>
      linearPredict(
        historyPoints,
        [statYear + 1, statYear + 2, statYear + 3, statYear + 4, statYear + 5]
      ),
    [historyPoints, statYear]
  );

  function updateMember(id: number, patch: Partial<Member>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function addMember(kind: "parent" | "child" | "other") {
    const nextId = members.length ? Math.max(...members.map((m) => m.id)) + 1 : 1;
    if (kind === "parent") {
      setMembers((prev) => [...prev, createMember(nextId, "parent", "other", `父母${nextId}`)]);
      return;
    }
    if (kind === "child") {
      setMembers((prev) => [...prev, createMember(nextId, "child", "other", `子女${nextId}`)]);
      return;
    }
    setMembers((prev) => [...prev, createMember(nextId, "other", "other", `成员${nextId}`)]);
  }

  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function updateHistoryPoint(year: number, value: string) {
    setHistoryPoints((prev) =>
      prev.map((h) => (h.year === year ? { ...h, point: value === "" ? null : Number(value) } : h))
    );
  }

  return (
    <main className="container">
      <div className="hero card">
        <div>
          <h1>北京小客车家庭积分计算器（官方规则版）</h1>
          <p className="muted">
            采用官方积分框架：主申请人2分、其他成员1分；普通摇号按“参与期数→阶梯积分”折算；
            新能源轮候按年折算；家庭申请每满一年全员+1；配偶系数与代际系数按政策公式计算。
          </p>
        </div>
        <span className="badge">重新按政策重构</span>
      </div>

      <section className="card stepper">
        <div className={`step ${step >= 1 ? "on" : ""}`}>1. 指标类型与截止时间</div>
        <div className={`step ${step >= 2 ? "on" : ""}`}>2. 家庭基础参数</div>
        <div className={`step ${step >= 3 ? "on" : ""}`}>3. 成员信息（年份）</div>
        <div className={`step ${step >= 4 ? "on" : ""}`}>4. 结果与5年预测</div>
      </section>

      {step === 1 && (
        <section className="card">
          <h2>① 指标类型 & 截止时间</h2>
          <div className="grid three">
            <label>
              你要算哪种指标
              <select
                value={indicatorType}
                onChange={(e) => setIndicatorType(e.target.value as IndicatorType)}
              >
                <option value="newEnergy">新能源指标</option>
                <option value="ordinary">油牌（普通指标）</option>
              </select>
            </label>

            {indicatorType === "ordinary" && (
              <label>
                油牌批次
                <select
                  value={ordinaryBatch}
                  onChange={(e) => setOrdinaryBatch(e.target.value as Half)}
                >
                  <option value="H1">上半年批次</option>
                  <option value="H2">下半年批次</option>
                </select>
              </label>
            )}

            <label>
              统计年份
              <select value={statYear} onChange={(e) => setStatYear(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => nowYear - i)
                  .sort((a, b) => a - b)
                  .map((year) => (
                    <option key={year} value={year}>
                      {year} 年
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <p className="deadline">{deadlineText}</p>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h2>② 家庭基础参数</h2>
          <div className="grid three">
            <label>
              家庭申请开始年份
              <select
                value={familyApplyStartYear ?? ""}
                onChange={(e) =>
                  setFamilyApplyStartYear(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">未开始 / 不确定</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year} 年
                  </option>
                ))}
              </select>
            </label>

            <label>
              家庭代际数
              <select value={generations} onChange={(e) => setGenerations(Number(e.target.value))}>
                <option value={1}>1 代</option>
                <option value={2}>2 代</option>
                <option value={3}>3 代</option>
              </select>
            </label>

            <label>
              是否包含配偶
              <select
                value={includeSpouse ? "yes" : "no"}
                onChange={(e) => setIncludeSpouse(e.target.value === "yes")}
              >
                <option value="yes">包含</option>
                <option value="no">不包含</option>
              </select>
            </label>
          </div>

          <p className="muted small">家庭申请加分年限：{familyApplyYears} 年</p>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h2>③ 成员年份信息（不填分数）</h2>
          <div className="actions">
            <button type="button" onClick={() => addMember("parent")}>+ 添加父母</button>
            <button type="button" onClick={() => addMember("child")}>+ 添加子女</button>
            <button type="button" onClick={() => addMember("other")}>+ 添加其他成员</button>
          </div>

          <div className="members">
            {visibleMembers.map((m) => (
              <article className="member" key={m.id}>
                <div className="member-head">
                  <div>
                    <strong>{m.name}</strong>
                    <p className="muted small">
                      {roleLabel(m.role)} · {relationLabel(m.relation)}
                    </p>
                  </div>
                  {m.role !== "main" && (
                    <button className="danger" type="button" onClick={() => removeMember(m.id)}>
                      删除
                    </button>
                  )}
                </div>

                <div className="grid four">
                  <label>
                    成员称呼
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMember(m.id, { name: e.target.value })}
                    />
                  </label>

                  <label>
                    普通摇号开始年份
                    <select
                      value={m.ordinaryStartYear ?? ""}
                      onChange={(e) =>
                        updateMember(m.id, {
                          ordinaryStartYear: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">未参与</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year} 年
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    普通摇号开始时段
                    <select
                      value={m.ordinaryStartHalf}
                      onChange={(e) => updateMember(m.id, { ordinaryStartHalf: e.target.value as Half })}
                    >
                      <option value="H1">上半年</option>
                      <option value="H2">下半年</option>
                    </select>
                  </label>

                  <label>
                    新能源轮候开始年份
                    <select
                      value={m.newEnergyStartYear ?? ""}
                      onChange={(e) =>
                        updateMember(m.id, {
                          newEnergyStartYear: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">未参与</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year} 年
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <>
          <section className="card result">
            <h2>④ 家庭积分结果</h2>
            {result.ok ? (
              <>
                <p className="score">家庭总积分：{result.total}</p>
                <p className="formula">{result.formulaText}</p>
                <ul className="detail-list">
                  {result.detail.map((d) => (
                    <li key={d.id}>
                      <strong>{d.name}</strong>（{roleLabel(d.role)} / {relationLabel(d.relation)}）：
                      基础{d.base} + 普通阶梯{d.ordinaryStep}(按参与{d.rounds}期折算) +
                      新能源轮候{d.newEnergyYears} + 家庭申请{d.familyYears} = <b>{d.point}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="warn">{result.message}</p>
            )}
          </section>

          <section className="card">
            <h2>⑤ 未来5年分数预测（趋势法）</h2>
            <p className="muted small">
              请先录入近5年你观察到的“入围分/最低分”（官方公布历史），系统用线性趋势预测未来5年。
              这不是官方预测，仅用于粗略参考。
            </p>

            <div className="grid five">
              {historyPoints.map((h) => (
                <label key={h.year}>
                  {h.year} 年历史分
                  <input
                    type="number"
                    min={0}
                    value={h.point ?? ""}
                    onChange={(e) => updateHistoryPoint(h.year, e.target.value)}
                    placeholder="例如 56"
                  />
                </label>
              ))}
            </div>

            <ul className="detail-list">
              {prediction.map((p) => (
                <li key={p.year}>
                  {p.year} 年预测分：{p.point === null ? "请先至少填2个历史分" : p.point}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="nav card">
        <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))}>
          上一步
        </button>
        <button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
          下一步
        </button>
      </section>

      <section className="card">
        <h2>官方规则口径（实现说明）</h2>
        <ul>
          <li>家庭总积分公式采用官方口径：含配偶 / 不含配偶两套公式。</li>
          <li>个人分 = 基础分 + 普通阶梯积分 + 新能源轮候积分 + 家庭申请年限积分。</li>
          <li>普通阶梯积分按“参与期数每24期晋一阶”折算；本工具用开始年份与上/下半年估算参与期数。</li>
          <li>截止时间展示“3月8日 / 10月8日”分批口径，最终以当年官方公告与系统为准。</li>
        </ul>
      </section>
    </main>
  );
}
