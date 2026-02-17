"use client";

import { useMemo, useState } from "react";

type MemberRole = "main" | "spouse" | "other";
type MemberRelation = "self" | "spouse" | "parent" | "child" | "other";

type Member = {
  id: number;
  role: MemberRole;
  relation: MemberRelation;
  name: string;
  ordinaryStartYear: number | null;
  newEnergyStartYear: number | null;
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
  if (!startYear) return 0;
  if (startYear > statYear) return 0;
  return statYear - startYear + 1;
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
    newEnergyStartYear: null,
  };
}

function createDefaultMembers() {
  return [
    createMember(1, "self", "main", "主申请人"),
    createMember(2, "spouse", "spouse", "配偶"),
  ];
}

function applyTemplate(template: "duo" | "family3" | "family4") {
  if (template === "duo") {
    return {
      includeSpouse: true,
      generations: 1,
      members: [
        createMember(1, "self", "main", "主申请人"),
        createMember(2, "spouse", "spouse", "配偶"),
      ],
    };
  }
  if (template === "family3") {
    return {
      includeSpouse: true,
      generations: 2,
      members: [
        createMember(1, "self", "main", "主申请人"),
        createMember(2, "spouse", "spouse", "配偶"),
        createMember(3, "child", "other", "子女1"),
      ],
    };
  }
  return {
    includeSpouse: true,
    generations: 3,
    members: [
      createMember(1, "self", "main", "主申请人"),
      createMember(2, "spouse", "spouse", "配偶"),
      createMember(3, "parent", "other", "父母1"),
      createMember(4, "parent", "other", "父母2"),
    ],
  };
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [statYear, setStatYear] = useState(nowYear);
  const [familyApplyStartYear, setFamilyApplyStartYear] = useState<number | null>(null);
  const [generations, setGenerations] = useState(2);
  const [includeSpouse, setIncludeSpouse] = useState(true);
  const [members, setMembers] = useState<Member[]>(createDefaultMembers());

  const yearOptions = useMemo(() => toYearOptions(statYear), [statYear]);
  const visibleMembers = useMemo(
    () => members.filter((m) => includeSpouse || m.role !== "spouse"),
    [members, includeSpouse]
  );
  const familyApplyYears = calcYears(familyApplyStartYear, statYear);

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
      const ordinaryYears = calcYears(m.ordinaryStartYear, statYear);
      const newEnergyYears = calcYears(m.newEnergyStartYear, statYear);
      const base = basePoint(m.role);
      const point = base + ordinaryYears + newEnergyYears + familyApplyYears;
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        relation: m.relation,
        base,
        ordinaryYears,
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

  function useTemplate(t: "duo" | "family3" | "family4") {
    const data = applyTemplate(t);
    setIncludeSpouse(data.includeSpouse);
    setGenerations(data.generations);
    setMembers(data.members);
  }

  return (
    <main className="container">
      <div className="hero card">
        <div>
          <h1>北京新能源家庭积分计算器</h1>
          <p className="muted">全下拉 + 向导模式。只用选年份，不需要自己算分。</p>
        </div>
        <span className="badge">小白友好</span>
      </div>

      <section className="card stepper">
        <div className={`step ${step >= 1 ? "on" : ""}`}>1. 选家庭模板</div>
        <div className={`step ${step >= 2 ? "on" : ""}`}>2. 基础参数</div>
        <div className={`step ${step >= 3 ? "on" : ""}`}>3. 成员年份</div>
        <div className={`step ${step >= 4 ? "on" : ""}`}>4. 看结果</div>
      </section>

      {step === 1 && (
        <section className="card">
          <h2>① 先选家庭模板</h2>
          <div className="actions">
            <button type="button" onClick={() => useTemplate("duo")}>夫妻二人</button>
            <button type="button" onClick={() => useTemplate("family3")}>三口之家（含1名子女）</button>
            <button type="button" onClick={() => useTemplate("family4")}>四口之家（含父母）</button>
          </div>
          <p className="muted small">选完模板后可继续增删成员。</p>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h2>② 家庭基础参数</h2>
          <div className="grid three">
            <label>
              统计到哪一年
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
          </div>

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

          <p className="muted small">家庭申请加分年限：{familyApplyYears} 年</p>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h2>③ 家庭成员（选开始年份）</h2>
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

                <div className="grid three">
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
        <section className="card result">
          <h2>④ 结果</h2>
          {result.ok ? (
            <>
              <p className="score">家庭总积分：{result.total}</p>
              <p className="formula">{result.formulaText}</p>
              <ul className="detail-list">
                {result.detail.map((d) => (
                  <li key={d.id}>
                    <strong>{d.name}</strong>（{roleLabel(d.role)} / {relationLabel(d.relation)}）：
                    基础{d.base} + 普通摇号{d.ordinaryYears} + 新能源轮候{d.newEnergyYears} +
                    家庭申请{d.familyYears} = <b>{d.point}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="warn">{result.message}</p>
          )}
        </section>
      )}

      <section className="nav card">
        <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))}>
          上一步
        </button>
        <button type="button" onClick={() => setStep((s) => Math.min(4, s + 1))}>
          下一步
        </button>
      </section>
    </main>
  );
}
