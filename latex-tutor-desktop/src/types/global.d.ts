export interface EngineStatus {
  installed: boolean;
  engines: {
    pdflatex: string | null;
    xelatex: string | null;
    tlmgr: string | null;
  };
}

export interface CompileResult {
  success: boolean;
  pdf?: Uint8Array;
  log: string;
  errors: string[];
  missingEngine?: boolean;
  missingPackage?: string | null;
}

export interface PackageInfo {
  name: string;
  sizeKB: number | null;
  shortdesc: string;
  installed?: boolean;
  approximate?: boolean;
}

export interface PackageListResult {
  source: "tlmgr" | "bundled";
  total: number;
  packages: PackageInfo[];
}

export interface ProgressState {
  completedLessons: string[];
  setupDismissed: boolean;
}

export interface FreeModeFiles {
  files: Record<string, string>;
  lastActiveFile: string;
}

export interface WindowApi {
  engine: {
    status: () => Promise<EngineStatus>;
    openInstallPage: (target: "miktex" | "tinytex") => Promise<boolean>;
  };
  compile: (payload: { files: Record<string, string>; mainFileName: string; engine?: "pdflatex" | "xelatex" }) => Promise<CompileResult>;
  packages: {
    list: (query: string) => Promise<PackageListResult>;
    install: (name: string) => Promise<{ success: boolean; message: string }>;
    onInstallProgress: (cb: (data: { name: string; chunk: string }) => void) => () => void;
  };
  progress: {
    get: () => Promise<ProgressState>;
    completeLesson: (lessonId: string) => Promise<string[]>;
    dismissSetup: (value: boolean) => Promise<void>;
  };
  freeMode: {
    getFiles: () => Promise<FreeModeFiles>;
    saveFile: (relPath: string, content: string) => Promise<void>;
    deleteFile: (relPath: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    api: WindowApi;
  }
}
