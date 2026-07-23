"use client";

import { useEffect, useState } from "react";

import { LessonContent } from "@/components/lesson/LessonContent";
import { LessonTutorPanel } from "@/components/lesson/LessonTutorPanel";
import { LessonVideo } from "@/components/lesson/LessonVideo";
import type { Lesson } from "@/types/lesson";

const LESSON_TUTOR_OPEN_CLASS = "lesson-tutor-open";

export function LessonWorkspace({
  keyPoints,
  lesson,
}: {
  keyPoints: string[];
  lesson: Lesson;
}) {
  const [isTutorOpen, setIsTutorOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle(LESSON_TUTOR_OPEN_CLASS, isTutorOpen);

    return () => {
      document.body.classList.remove(LESSON_TUTOR_OPEN_CLASS);
    };
  }, [isTutorOpen]);

  return (
    <div>
      <div
        className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]"
        data-testid="lesson-layout"
      >
        <div className="space-y-6">
          <LessonVideo lesson={lesson} />
          <LessonContent lesson={lesson} />
        </div>
        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              In this lesson
            </p>
            <div className="mt-5 space-y-3">
              {keyPoints.map((point, index) => (
                <div
                  key={`${lesson.slug}-point-${index + 1}`}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Key idea 0{index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-zinc-300">{point}</p>
                </div>
              ))}
            </div>
          </div>
          <LessonTutorPanel
            isOpen={isTutorOpen}
            lessonTitle={lesson.title}
            onOpenChange={setIsTutorOpen}
          />
        </aside>
      </div>
    </div>
  );
}
