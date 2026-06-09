import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home">
      <section className="homePanel">
        <h1>AI 学情分析与课堂二维码答题</h1>
        <p>从 Excel 导入题目，生成课堂二维码，实时收集答题并生成学情报告。</p>
        <Link href="/teacher" className="primaryLink">进入教师端</Link>
      </section>
    </main>
  );
}
