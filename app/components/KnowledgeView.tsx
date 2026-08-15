"use client";

import {
  CUISINE_CATEGORIES,
  CUSTOMS_AND_RULES,
  KNOWLEDGE_SOURCES,
  REGIONAL_SPECIALTIES,
  type JapanLink,
} from "@/lib/japan-content";

function LinkList({ links }: { links: JapanLink[] }) {
  return (
    <ul className="source-list">
      {links.map((source) => (
        <li key={source.href}>
          <a href={source.href} target="_blank" rel="noreferrer">
            {source.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function KnowledgeView() {
  return (
    <section className="dashboard-view knowledge-view">
      <div className="page-heading">
        <div className="eyebrow">下次旅行前，先知道一點</div>
        <h1>日本小知識</h1>
        <p className="page-intro">把走過的地方、想吃的味道與日常禮儀，放在同一頁慢慢看。</p>
      </div>
      <div className="knowledge-grid">
        <article className="knowledge-card wide">
          <h2>旅程沿線的地方味道</h2>
          <div className="regional-grid">
            {REGIONAL_SPECIALTIES.map((item) => (
              <div key={item.place}>
                <strong>{item.place}</strong>
                <span>{item.foods.join("、")}</span>
                <a href={item.source.href} target="_blank" rel="noreferrer">
                  {item.source.label}
                </a>
              </div>
            ))}
          </div>
        </article>
        <article className="knowledge-card wide">
          <h2>日本美食分類</h2>
          <div className="cuisine-grid">
            {CUISINE_CATEGORIES.map((item) => (
              <div key={item.name}>
                <strong>{item.name}</strong>
                <span>{item.examples}</span>
              </div>
            ))}
          </div>
          <LinkList links={KNOWLEDGE_SOURCES.slice(0, 2)} />
        </article>
        {CUSTOMS_AND_RULES.map((item) => (
          <article className="knowledge-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <a href={item.source.href} target="_blank" rel="noreferrer">
              {item.source.label}
            </a>
          </article>
        ))}
        <article className="knowledge-card">
          <h2>再出發前的官方資料</h2>
          <LinkList links={KNOWLEDGE_SOURCES.slice(2)} />
        </article>
      </div>
    </section>
  );
}
