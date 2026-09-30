"use client";

import { Computer, Coffee, Wifi } from "lucide-react";

const STATS = [
  {
    label: "Stations",
    value: "24",
    icon: Computer,
  },
  {
    label: "Speed",
    value: "1 Gbps",
    icon: Wifi,
  },
  {
    label: "Roasts",
    value: "12+",
    icon: Coffee,
  },
];

export function HeroSection() {
  return (
    <section className="bg-[#f5f1e8] py-20 md:py-28 lg:py-32">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left column */}
          <div className="max-w-xl">
            <h1 className="font-['Playfair_Display',Georgia,Times,serif] text-5xl leading-[1.1] tracking-tight md:text-[64px]">
              A sanctuary for{" "}
              <span className="italic text-[#7a5f28]">deep work</span>
              <br />
              and coffee.
            </h1>
            <p className="mt-6 text-base leading-relaxed text-[#1e2a1e]/60 md:text-lg">
              Premium connectivity, specialty roasts, and quiet corners designed
              for students and professionals who value focus.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#rates"
                className="inline-flex items-center gap-2 rounded-full bg-[#1e2a1e] px-6 py-3 text-sm font-bold text-[#f5f1e8] hover:bg-[#7a5f28] transition-colors"
              >
Explore PC Services
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
              <a
                href="#rates"
                className="inline-flex items-center rounded-full border border-[#1e2a1e]/20 px-6 py-3 text-sm font-bold text-[#1e2a1e] hover:border-[#7a5f28] hover:text-[#7a5f28] transition-colors"
              >
                View Passes
              </a>
            </div>
          </div>

          {/* Right column — Browser window card */}
          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-[#1e2a1e]/8 bg-[#ebe6d9] shadow-[0_20px_60px_rgba(30,42,30,0.1)]">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 py-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1e2a1e]/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#1e2a1e]/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#1e2a1e]/15" />
                <span className="ml-3 text-xs font-semibold uppercase tracking-widest text-[#1e2a1e]/50">
                  Workspace Overview
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 px-5 pb-5">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-[#f5f1e8] p-4 text-center"
                  >
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e2a1e]/8 text-[#7a5f28]">
                      <stat.icon size={18} aria-hidden="true" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1e2a1e]/50">
                      {stat.label}
                    </p>
                    <p className="mt-1 font-['Playfair_Display',Georgia,Times,serif] text-xl font-bold text-[#1e2a1e]">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
