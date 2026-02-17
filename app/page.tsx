"use client";

import { useMemo, useState } from "react";

type MemberRole = "main" | "spouse" | "other";

type Member = {
  id: number;
  name: string;
  role: MemberRole;
  ordinarySteps: number;
  newEnergyWaitYears: number;
};

function roleLabel(role: MemberRole) {
  if (role === "main") return "主申请人";
  if (role === "spouse") return "配偶";
  return "其他成员";
}

function basePoint(role: MemberRole) {
  return role === "main" ? 2 : 1;
}

function calcMemberPoint(member: Member, familyApplyYears: number) {
  const stepPoint = member.ordinarySteps + member.newEnergyWaitYears;
  return basePoint(member.role) + stepPoint + familyApplyYears;
}

export default function Home() {
  const [includeSpouse, setIncludeSpouse] = useState(true);
  const [generations, setGenerations] = useState(2);
  const [familyApplyYears, setFamilyApplyYears] = useState(0);
  const [members, setMembers] = useState<Member[]>([
    { id: 1, name: "主申请人", role: "main", ordinarySteps: 0, newEnergyWaitYears: 0 },
    { id: 2, name: "配偶", role: "spouse", ordinarySteps: 0, newEnergyWaitYears: 0 },
    { id: 3, name: "成员1", role: "other", ordinarySteps: 0, newEnergyWaitYears: 0 },
  ]);

  const visibleMembers = members.filter((m) => includeSpouse || m.role !== "spouse");

  const result = useMemo(() => {
    const main = visibleMembers.find((m) => m.role === "main");
    const spouse = visibleMembers.find((m) => m.role === "spouse");
    const others = visibleMembers.filter((m) => m.role === "other");

    if (!main) {
      return {
        ok: false,
        message: "至少需要 1 名主申请人。",
        total: 0,
        detail: [] as Array<{ name: string; point: number; role: MemberRole }>,
        formulaText: "",
      };
    }

    if (includeSpouse && !spouse) {
      return {
        ok: false,
        message: "已勾选“包含配偶”，但未添加配偶成员。",
        total: 0,
        detail: [] as Array<{ name: string; point: number; role: MemberRole }>,
        formulaText: "",
      };
    }

    const detail = visibleMembers.map((m) => ({
      name: m.name,
      role: m.role,
      point: calcMemberPoint(m, familyApplyYears),
    }));

    const mainPoint = calcMemberPoint(main, familyApplyYears);
    const spousePoint = spouse ? calcMemberPoint(spouse, familyApplyYears) : 0;
    const othersPoint = others.reduce(
      (sum, m) => sum + calcMemberPoint(m, familyApplyYears),
      0
    );

    const total = includeSpouse
      ? ((mainPoint + spousePoint) * 2 + othersPoint) * generations
      : (mainPoint + othersPoint) * generations;

    const formulaText = includeSpouse
      ? `总积分 = [(${mainPoint} + ${spousePoint}) × 2 + ${othersPoint}] × ${generations}`
      : `总积分 = (${mainPoint} + ${othersPoint}) × ${generations}`;

    return {
      ok: true,
      message: "",
      total,
      detail,
      formulaText,
    };
  }, [visibleMembers, includeSpouse, generations, familyApplyYears]);

  function updateMember(id: number, patch: Partial<Member>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function addOtherMember() {
    const nextId = members.length ? Math.max(...members.map((m) => m.id)) + 1 : 1;
    setMembers((prev) => [
      ...prev,
      {
        id: nextId,
        name: `成员${nextId}`,
        role: "other",
        ordinarySteps: 0,
        newEnergyWaitYears: 0,
      },
    ]);
  }

  function removeMember(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <main className="container">
      <h1>北京新能源家庭积分计算器（参考版）</h1>
      <p className="muted">
        用于估算家庭申请新能源小客车指标时的家庭总积分。
        <br />
        计算规则参考北京市政策解读与公开说明，最终以官方系统实时计算结果为准。
      </p>

      <section className="card">
        <h2>1) 家庭参数</h2>
        <div className="grid two">
          <label>
            家庭申请年限（满一年加 1 分）
            <input
              type="number"
              min={0}
              value={familyApplyYears}
              onChange={(e) => setFamilyApplyYears(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>

          <label>
            家庭代际数（1-3）
            <input
              type="number"
              min={1}
              max={3}
              value={generations}
              onChange={(e) => {
                const n = Number(e.target.value || 1);
                setGenerations(Math.min(3, Math.max(1, n)));
              }}
            />
          </label>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeSpouse}
            onChange={(e) => setIncludeSpouse(e.target.checked)}
          />
          家庭申请人中包含主申请人配偶
        </label>
      </section>

      <section className="card">
        <h2>2) 成员积分</h2>
        <p className="muted small">
          个人积分 = 基础积分 + 阶梯(轮候)积分 + 家庭申请年限加分。
          <br />
          建议：不适用项填 0；“普通摇号阶梯数”和“新能源轮候年限”请按个人实际情况填写。
        </p>

        <div className="members">
          {members
            .filter((m) => includeSpouse || m.role !== "spouse")
            .map((m) => {
              const point = calcMemberPoint(m, familyApplyYears);
              return (
                <div className="member" key={m.id}>
                  <div className="member-head">
                    <strong>{roleLabel(m.role)}</strong>
                    {m.role === "other" && (
                      <button type="button" onClick={() => removeMember(m.id)}>
                        删除
                      </button>
                    )}
                  </div>

                  <div className="grid three">
                    <label>
                      称呼
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => updateMember(m.id, { name: e.target.value })}
                      />
                    </label>

                    <label>
                      普通摇号阶梯数
                      <input
                        type="number"
                        min={0}
                        value={m.ordinarySteps}
                        onChange={(e) =>
                          updateMember(m.id, {
                            ordinarySteps: Math.max(0, Number(e.target.value || 0)),
                          })
                        }
                      />
                    </label>

                    <label>
                      新能源轮候年限（整年）
                      <input
                        type="number"
                        min={0}
                        value={m.newEnergyWaitYears}
                        onChange={(e) =>
                          updateMember(m.id, {
                            newEnergyWaitYears: Math.max(0, Number(e.target.value || 0)),
                          })
                        }
                      />
                    </label>
                  </div>

                  <p className="muted small">
                    基础积分 {basePoint(m.role)} + 阶梯(轮候)积分 {m.ordinarySteps + m.newEnergyWaitYears}
                    + 家庭申请年限 {familyApplyYears} = <strong>{point}</strong>
                  </p>
                </div>
              );
            })}
        </div>

        <button type="button" onClick={addOtherMember}>
          + 添加其他成员
        </button>
      </section>

      <section className="card result">
        <h2>3) 计算结果</h2>
        {result.ok ? (
          <>
            <p className="score">家庭总积分：{result.total}</p>
            <p className="formula">{result.formulaText}</p>
            <ul>
              {result.detail.map((d) => (
                <li key={`${d.role}-${d.name}`}>
                  {d.name}（{roleLabel(d.role)}）：{d.point} 分
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="warn">{result.message}</p>
        )}
      </section>

      <section className="card">
        <h2>规则参考</h2>
        <ul>
          <li>
            家庭主申请人基础积分 2 分；其他家庭申请人基础积分每人 1 分。
          </li>
          <li>
            家庭申请每满一年，所有家庭申请人积分各增加 1 分。
          </li>
          <li>
            含配偶时：总积分 = [(主申请人积分 + 配偶积分) × 2 + 其他成员积分之和] × 家庭代际数。
          </li>
          <li>
            不含配偶时：总积分 = (主申请人积分 + 其他成员积分之和) × 家庭代际数。
          </li>
        </ul>
        <p className="muted small">
          参考：
          <a href="https://www.beijing.gov.cn/zhengce/zcjd/zcwd/jtjf/" target="_blank">
            北京市政府门户“北京摇号新政——如何计算家庭积分？”
          </a>
          、
          <a href="https://bj.bendibao.com/news/202115/286327.shtm" target="_blank">
            北京本地宝政策整理页（含公式）
          </a>
        </p>
      </section>
    </main>
  );
}
