import { useEffect, useState } from "react";
import { lessons, modules, lessonsByModule } from "../lessons/curriculum";
import { Workspace } from "./Workspace";

interface LessonsViewProps {
  isActive?: boolean;
  onGoToPackage: (packageName: string) => void;
}

export function LessonsView({ isActive, onGoToPackage }: LessonsViewProps) {
  const [selectedId, setSelectedId] = useState(lessons[0].id);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [code, setCode] = useState(lessons[0].guidedStarter);
  const [showExample, setShowExample] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [openModule, setOpenModule] = useState(lessons[0].moduleId);

  const lesson = lessons.find((l) => l.id === selectedId)!;
  const currentModule = modules.find((m) => m.id === lesson.moduleId)!;

  useEffect(() => {
    window.api.progress.get().then((p) => setCompleted(new Set(p.completedLessons)));
  }, []);

  useEffect(() => {
    setCode(lesson.guidedStarter);
    setShowExample(false);
    setShowHints(false);
    setShowSolution(false);
  }, [lesson.id, lesson.guidedStarter]);

  async function markComplete() {
    const list = await window.api.progress.completeLesson(lesson.id);
    setCompleted(new Set(list));
    const idx = lessons.findIndex((l) => l.id === lesson.id);
    if (idx >= 0 && idx + 1 < lessons.length) {
      const next = lessons[idx + 1];
      setSelectedId(next.id);
      setOpenModule(next.moduleId);
    }
  }

  return (
    <div className="lessons-view">
      <aside className="lessons-sidebar">
        <h2>Trilha de aprendizagem</h2>
        {modules.map((mod) => {
          const modLessons = lessonsByModule(mod.id);
          const doneCount = modLessons.filter((l) => completed.has(l.id)).length;
          const isOpen = openModule === mod.id;
          return (
            <div key={mod.id} className="lessons-module-group">
              <button className="lessons-module-header" onClick={() => setOpenModule(isOpen ? "" : mod.id)}>
                <span>{isOpen ? "▾" : "▸"} {mod.title}</span>
                <span className="lessons-module-progress">
                  {doneCount}/{modLessons.length}
                </span>
              </button>
              {isOpen && (
                <ol className="lessons-list">
                  {modLessons.map((l) => (
                    <li key={l.id}>
                      <button
                        className={`lessons-list-item ${l.id === selectedId ? "active" : ""}`}
                        onClick={() => setSelectedId(l.id)}
                      >
                        <span className="lessons-list-check">{completed.has(l.id) ? "✔" : l.order}</span>
                        {l.title}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </aside>

      <div className="lessons-main">
        <div className="lessons-header">
          <div className="lessons-breadcrumb">{currentModule.title}</div>
          <h1>{lesson.title}</h1>
          <p className="lessons-explanation">{lesson.explanation}</p>

          <div className="lessons-actions-row">
            <button onClick={() => setShowExample((v) => !v)}>{showExample ? "Ocultar exemplo pronto" : "Ver exemplo pronto"}</button>
            <button
              title="Restaura o código inicial desta lição, desfazendo qualquer alteração ou exclusão acidental"
              onClick={() => setCode(lesson.guidedStarter)}
            >
              ↺ Restaurar código original
            </button>
            <button className="lessons-complete-btn" onClick={markComplete}>
              {completed.has(lesson.id) ? "✔ Concluído — avançar para o próximo" : "Marcar como concluído e avançar"}
            </button>
          </div>

          {showExample && (
            <div className="lessons-example">
              <p>{lesson.example.description}</p>
              <pre>{lesson.example.code}</pre>
              <button onClick={() => setCode(lesson.example.code)}>Inserir exemplo no editor</button>
            </div>
          )}

          <p className="lessons-guided-instructions">
            <strong>Agora tente:</strong> {lesson.guidedInstructions}
          </p>
        </div>

        <Workspace
          storageKey="lessons-workspace"
          jobKey="lessons"
          isActive={isActive}
          code={code}
          onChange={setCode}
          engine={lesson.engine}
          suggestedPdfName={lesson.title}
          onGoToPackage={onGoToPackage}
        />

        <div className="lessons-challenge-panel">
          <h2>Desafio</h2>
          <p>{lesson.challenge}</p>
          <div className="lessons-actions-row">
            <button onClick={() => setCode(lesson.challengeStarter)}>Carregar desafio no editor</button>
            <button onClick={() => setShowHints((v) => !v)}>{showHints ? "Ocultar dicas" : "Ver dicas"}</button>
            <button onClick={() => setShowSolution((v) => !v)}>{showSolution ? "Ocultar solução" : "Ver solução comentada"}</button>
          </div>
          {showHints && (
            <ul className="lessons-hints">
              {lesson.hints.map((hint, i) => (
                <li key={i}>{hint}</li>
              ))}
            </ul>
          )}
          {showSolution && (
            <div className="lessons-example">
              <pre>{lesson.solution}</pre>
              <button onClick={() => setCode(lesson.solution)}>Inserir solução no editor</button>
            </div>
          )}
          <div className="lessons-commands-learned">
            <strong>Comandos aprendidos:</strong>{" "}
            {lesson.commandsLearned.map((cmd) => (
              <code key={cmd} className="lessons-command-tag">
                {cmd}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
