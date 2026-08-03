import { useEffect, useState } from "react";
import { lessons } from "../lessons/curriculum";
import { Workspace } from "./Workspace";

interface LessonsViewProps {
  onGoToPackage: (packageName: string) => void;
}

export function LessonsView({ onGoToPackage }: LessonsViewProps) {
  const [selectedId, setSelectedId] = useState(lessons[0].id);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [code, setCode] = useState(lessons[0].starterCode);

  const lesson = lessons.find((l) => l.id === selectedId)!;

  useEffect(() => {
    window.api.progress.get().then((p) => setCompleted(new Set(p.completedLessons)));
  }, []);

  useEffect(() => {
    setCode(lesson.starterCode);
  }, [lesson.id, lesson.starterCode]);

  async function markComplete() {
    const list = await window.api.progress.completeLesson(lesson.id);
    setCompleted(new Set(list));
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    if (idx >= 0 && idx + 1 < lessons.length) {
      setSelectedId(lessons[idx + 1].id);
    }
  }

  return (
    <div className="lessons-view">
      <aside className="lessons-sidebar">
        <h2>Níveis</h2>
        <ol className="lessons-list">
          {lessons.map((l) => (
            <li key={l.id}>
              <button
                className={`lessons-list-item ${l.id === selectedId ? "active" : ""}`}
                onClick={() => setSelectedId(l.id)}
              >
                <span className="lessons-list-check">{completed.has(l.id) ? "✔" : l.level}</span>
                {l.title}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <div className="lessons-main">
        <div className="lessons-header">
          <h1>
            Nível {lesson.level}: {lesson.title}
          </h1>
          <p className="lessons-explanation">{lesson.explanation}</p>
          <p className="lessons-challenge">
            <strong>Desafio:</strong> {lesson.challenge}
          </p>
          <button className="lessons-complete-btn" onClick={markComplete}>
            {completed.has(lesson.id) ? "✔ Concluído — avançar para o próximo" : "Marcar como concluído e avançar"}
          </button>
        </div>

        <Workspace
          storageKey="lessons-workspace"
          code={code}
          onChange={setCode}
          engine={lesson.engine}
          onGoToPackage={onGoToPackage}
        />
      </div>
    </div>
  );
}
