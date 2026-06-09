"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { importAndCreateClassroom } from "@/components/teacherRequests";
import { saveStoredClassroom } from "@/components/teacherClassroom";

export default function QuestionEditor() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [expectedCount, setExpectedCount] = useState("30");
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    setIsImporting(true);

    try {
      const result = await importAndCreateClassroom({
        file,
        title,
        expectedCountText: expectedCount,
        saveClassroom: saveStoredClassroom,
        navigate: (path) => router.push(path),
      });

      if (result.status === "error") {
        setError(result.error);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="teacherShell">
      <header className="teacherTopbar">
        <div>
          <p className="teacherEyebrow">教师端</p>
          <h1>课堂题目导入</h1>
        </div>
      </header>

      <section className="teacherContent">
        <form className="teacherPanel importPanel" onSubmit={handleSubmit}>
          <div className="formGrid">
            <label className="formField">
              <span>Excel 文件</span>
              <input
                data-testid="excel-file-input"
                type="file"
                accept=".xlsx"
                onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              />
            </label>

            <label className="formField">
              <span>课堂标题</span>
              <input
                data-testid="classroom-title-input"
                type="text"
                value={title}
                placeholder="例如：五年级分数复习"
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
            </label>

            <label className="formField">
              <span>预计人数</span>
              <input
                data-testid="expected-count-input"
                type="number"
                min="1"
                value={expectedCount}
                onChange={(event) => setExpectedCount(event.currentTarget.value)}
              />
            </label>
          </div>

          {error ? <p className="errorText">{error}</p> : null}

          <div className="actionRow">
            <button
              data-testid="import-button"
              className="primaryButton"
              type="submit"
              disabled={isImporting}
            >
              {isImporting ? "导入中" : "导入并创建课堂"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
