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
  hasC5: boolean;
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

// 每满一年（统计年上一年12月31日前）
function calcFullYears(startYear: number | null, statYear: number) {
  if (!startYear) return 0;
  const years = statYear - startYear;
  return years > 0 ? years : 0;
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
    hasC5: false,
  };
}

function createDefaultMembers() {
  return [
    createMember(1, "self", "main", "主申请人"),
    createMember(2, "spouse", "spouse", "配偶"),
  ];
}

// 估算某时间段普通摇号参与期数（工程估算口径：每年6期）
function calcRoundsInPeriod(
  startYear: number | null,
  half: Half,
  periodFromYear: number,
  periodToYear: number
) {
  if (!startYear || periodFromYear > periodToYear || startYear > periodToYear) return 0;

  const beginYear = Math.max(startYear, periodFromYear);
  let rounds = 0;

  for (let y = beginYear; y <= periodToYear; y += 1) {
    if (y === startYear) {
      rounds += half === "H1" ? 6 : 3;
    } else {
      rounds += 6;
    }
  }

  return rounds;
}

// 截至2020-12-31：1-2次=1分，3-4次=2分 ... 73-78次=13分
function legacyStepByRounds(rounds: number) {
  if (rounds <= 0) return 0;
  return Math.min(13, Math.ceil(rounds / 2));
}

// 2021-01-01后：1-6次=1分，7-12次=2分...
function post2021StepByRounds(rounds: number) {
  if (rounds <= 0) return 0;
  return Math.ceil(rounds / 6);
}

function calcOrdinaryStepDetail(member: Member, statYear: number) {
  if (!member.ordinaryStartYear) {
    return {
      pre2020Rounds: 0,
      post2021Rounds: 0,
      pre2020Step: 0,
      post2021Step: 0,
      c5Extra: 0,
      totalStep: 0,
    };
  }

  const pre2020Rounds = calcRoundsInPeriod(member.ordinaryStartYear, member.ordinaryStartHalf, START_YEAR, 2020);
  const post2021Rounds = calcRoundsInPeriod(member.ordinaryStartYear, member.ordinaryStartHalf, 2021, statYear);

  const pre2020Step = legacyStepByRounds(pre2020Rounds);
  const post2021Step = post2021StepByRounds(post2021Rounds);

  const hasOrdinary = pre2020Rounds + post2021Rounds > 0;
  const c5Extra = hasOrdinary && member.role === "main" && member.hasC5 ? 1 : 0;

  return {
    pre2020Rounds,
    post2021Rounds,
    pre2020Step,
    post2021Step,
    c5Extra,
    totalStep: pre2020Step + post2021Step + c5Extra,
  };
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
  const familyApplyYears = calcFullYears(familyApplyStartYear, statYear);

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
      const ordinary = calcOrdinaryStepDetail(m, statYear);
      const queueYears = calcFullYears(m.newEnergyStartYear, statYear);
      const base = basePoint(m.role);
      const queueStep = queueYears;
      const stageStep = ordinary.totalStep + queueStep;
      const point = base + stageStep + familyApplyYears;

      return {
        id: m.id,
        name: m.name,
        role: m.role,
        relation: m.relation,
        base,
        pre2020Rounds: ordinary.pre2020Rounds,
        post2021Rounds: ordinary.post2021Rounds,
        pre2020Step: ordinary.pre2020Step,
        post2021Step: ordinary.post2021Step,
        c5Extra: ordinary.c5Extra,
        ordinaryStep: ordinary.totalStep,
        queueStep,
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
            新口径：个人分=基础分+阶梯（轮候）分；家庭总分按是否含配偶套用公式，并乘家庭代际数。
            阶梯分拆分为“普通摇号阶梯 + 新能源轮候年限分”，家庭申请每满一年全员加1分。
          </p>
        </div>
        <span className="badge">按 AGENTS 规则重算</span>
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

          <p className="muted small">家庭申请年限加分：每满一年 +1，当前计入 {familyApplyYears} 年</p>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h2>③ 成员信息（不手填分值）</h2>
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

                {m.role === "main" && (
                  <div className="grid three" style={{ marginTop: 10 }}>
                    <label>
                      主申请人是否具备 C5 驾照
                      <select
                        value={m.hasC5 ? "yes" : "no"}
                        onChange={(e) => updateMember(m.id, { hasC5: e.target.value === "yes" })}
                      >
                        <option value="no">否</option>
                        <option value="yes">是（额外+1阶）</option>
                      </select>
                    </label>
                  </div>
                )}
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
                      基础{d.base} + 普通阶梯{d.ordinaryStep}
                      （2020前{d.pre2020Step}分, 2021后{d.post2021Step}分{d.c5Extra ? `, C5加${d.c5Extra}` : ""}） +
                      新能源轮候{d.queueStep} + 家庭申请{d.familyYears} = <b>{d.point}</b>
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
              请录入近5年官方历史“入围分/最低分”，系统用线性趋势预测未来5年。
              这不是官方预测，仅用于辅助参考。
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
        <h2>规则说明（图文 + 表格）</h2>
        <p className="muted small">为了更直观，下面把核心规则做成图标卡片、阶梯表和算例卡片。</p>

        <div className="icon-cards">
          <article className="icon-card">
            <img src="/icons/score.svg" alt="个人积分图标" width={40} height={40} />
            <div>
              <h3>个人积分</h3>
              <p>个人积分 = 基础积分 + 阶梯（轮候）积分 + 家庭申请年限积分</p>
            </div>
          </article>

          <article className="icon-card">
            <img src="/icons/family.svg" alt="家庭积分图标" width={40} height={40} />
            <div>
              <h3>家庭总积分</h3>
              <p>含配偶与不含配偶使用不同公式，并统一乘家庭代际数（最多3代）。</p>
            </div>
          </article>

          <article className="icon-card">
            <img src="/icons/formula.svg" alt="公式拆解图标" width={40} height={40} />
            <div>
              <h3>系统自动拆解</h3>
              <p>不让用户手填分数，仅填年份与成员结构，系统自动换算并展示过程。</p>
            </div>
          </article>
        </div>

        <h3>1）普通摇号阶梯（关键分段）</h3>
        <div className="table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th>阶段</th>
                <th>累计参加次数</th>
                <th>对应阶梯分</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2020-12-31前</td>
                <td>1-2 / 3-4 / 5-6 / 7-8 / ... / 73-78</td>
                <td>1 / 2 / 3 / 4 / ... / 13</td>
              </tr>
              <tr>
                <td>2021-01-01后</td>
                <td>1-6 / 7-12 / 13-18 / 19-24 / ...</td>
                <td>1 / 2 / 3 / 4 / ...</td>
              </tr>
              <tr>
                <td>特殊加分</td>
                <td>主申请人具备C5且参与普通摇号</td>
                <td>额外 +1 阶</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>2）家庭总积分公式</h3>
        <ul>
          <li>含配偶：总积分 = [（主申请人积分 + 配偶积分）×2 + 其他成员积分之和] × 家庭代际数</li>
          <li>不含配偶：总积分 = （主申请人积分 + 其他成员积分之和）× 家庭代际数</li>
        </ul>

        <h3>3）算例卡片</h3>
        <div className="example-grid">
          <article className="example-card">
            <h4>示例A：夫妻 + 1名子女（2代）</h4>
            <p>主申请人=18，配偶=16，子女=12，代际=2</p>
            <p className="formula">[(18 + 16) × 2 + 12] × 2 = 160</p>
            <p><b>家庭总积分：160</b></p>
          </article>

          <article className="example-card">
            <h4>示例B：三代同堂（含配偶）</h4>
            <p>主申请人=20，配偶=19，其他成员合计=78，代际=3</p>
            <p className="formula">[(20 + 19) × 2 + 78] × 3 = 468</p>
            <p><b>家庭总积分：468</b></p>
          </article>

          <article className="example-card">
            <h4>示例C：不含配偶（主申请人+父母）</h4>
            <p>主申请人=17，其他成员合计=24，代际=2</p>
            <p className="formula">(17 + 24) × 2 = 82</p>
            <p><b>家庭总积分：82</b></p>
          </article>
        </div>

        <p className="muted small">说明：上述算例为演示口径，最终以当年政策公告和系统实时计算结果为准。</p>
      </section>
    </main>
  );
}
