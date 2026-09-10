export interface LessonExample {
  description: string;
  code: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  order: number;
  title: string;
  engine: "pdflatex" | "xelatex";
  explanation: string;
  example: LessonExample;
  guidedStarter: string;
  guidedInstructions: string;
  challenge: string;
  challengeStarter: string;
  hints: string[];
  solution: string;
  commandsLearned: string[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
}
