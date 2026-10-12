"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Check, 
  X 
} from "lucide-react";

interface CustomDateTimePickerProps {
  value: string; // ISO string or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  includeTime?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CustomDateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time...",
  className = "",
  includeTime = true,
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize with safe static values during SSR prerender
  const [viewYear, setViewYear] = useState<number>(2026);
  const [viewMonth, setViewMonth] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [todayInfo, setTodayInfo] = useState<{ day: number; month: number; year: number } | null>(null);

  // Time state (12-hour format) - NO prebuilt numbers
  const [hours, setHours] = useState<string>("");
  const [minutes, setMinutes] = useState<string>("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Sync internal state when client mounts or value prop changes (client-only evaluation)
  useEffect(() => {
    const t = new Date();
    setTodayInfo({ day: t.getDate(), month: t.getMonth(), year: t.getFullYear() });

    if (value) {
      const d = new Date(value);
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      const h = d.getHours();
      setHours((h % 12 || 12).toString().padStart(2, "0"));
      setMinutes(d.getMinutes().toString().padStart(2, "0"));
      setAmpm(h >= 12 ? "PM" : "AM");
    } else {
      setViewYear(t.getFullYear());
      setViewMonth(t.getMonth());
      setSelectedDate(null);
      setHours("");
      setMinutes("");
      setAmpm("AM");
    }
  }, [value]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Generate calendar days
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const handleSelectDay = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day);
    setSelectedDate(newDate);

    if (!includeTime) {
      onChange(newDate.toISOString());
      setIsOpen(false);
    }
  };

  const handleApply = () => {
    const base = selectedDate || new Date();
    const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());

    if (includeTime) {
      const parsedH = hours ? parseInt(hours) : 12;
      const parsedM = minutes ? parseInt(minutes) : 0;
      let h = parsedH % 12;
      if (ampm === "PM") h += 12;
      result.setHours(h, parsedM, 0, 0);
    }

    onChange(result.toISOString());
    setIsOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    setSelectedDate(now);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    const h = now.getHours();
    setHours((h % 12 || 12).toString().padStart(2, "0"));
    setMinutes(now.getMinutes().toString().padStart(2, "0"));
    setAmpm(h >= 12 ? "PM" : "AM");
    onChange(now.toISOString());
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedDate(null);
    setHours("");
    setMinutes("");
    onChange("");
    setIsOpen(false);
  };

  // Format display text
  const formatDisplay = () => {
    if (!value) return null;
    const d = new Date(value);
    const dateStr = d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    if (!includeTime) return dateStr;
    const timeStr = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr}, ${timeStr}`;
  };

  const isToday = (day: number) => {
    if (!todayInfo) return false;
    return (
      todayInfo.day === day &&
      todayInfo.month === viewMonth &&
      todayInfo.year === viewYear
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getFullYear() === viewYear
    );
  };

  return (
    <div className={`relative inline-block w-full text-xs font-sans ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-xs transition-all cursor-pointer hover:border-zinc-300 ${
          isOpen ? "border-emerald-500 ring-1 ring-emerald-500/20" : ""
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span className={`truncate ${value ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>
            {formatDisplay() || placeholder}
          </span>
        </div>

        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-0.5 text-zinc-400 hover:text-zinc-700 cursor-pointer rounded"
            title="Clear date"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Floating Popover on Top of Everything (z-50) */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1 rounded-xl border border-zinc-200 bg-white shadow-2xl z-50 p-4 w-72 animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: "280px" }}
        >
          {/* Calendar Month & Year Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-zinc-900 text-xs">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((d) => (
              <span key={d} className="text-[10px] font-mono font-medium text-zinc-400">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Previous month tail */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <span
                key={`prev_${i}`}
                className="h-7 flex items-center justify-center text-[11px] text-zinc-300 font-mono"
              >
                {prevMonthDays - firstDayIndex + i + 1}
              </span>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto rounded-md flex items-center justify-center text-xs font-mono transition-all cursor-pointer ${
                    selected
                      ? "bg-[#107548] text-white font-bold shadow-xs"
                      : today
                      ? "border border-emerald-500 text-emerald-700 font-semibold hover:bg-emerald-50"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time Picker Section */}
          {includeTime && (
            <div className="mt-3 pt-3 border-t border-zinc-100">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Time</span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  {/* Hours Input (No Up/Down Buttons, No Prebuilt Number, No Scroll Change) */}
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="HH"
                    value={hours}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setHours("");
                        return;
                      }
                      if (/^\d{1,2}$/.test(val)) {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setHours(Math.min(12, Math.max(1, num)).toString());
                        }
                      }
                    }}
                    className="w-10 rounded-md border border-zinc-200 bg-white py-1 text-center text-xs font-mono font-medium text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-hidden"
                  />

                  <span className="font-bold text-zinc-400">:</span>

                  {/* Minutes Input (No Up/Down Buttons, No Prebuilt Number, No Scroll Change) */}
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="MM"
                    value={minutes}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setMinutes("");
                        return;
                      }
                      if (/^\d{1,2}$/.test(val)) {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setMinutes(Math.min(59, Math.max(0, num)).toString().padStart(val.length > 1 ? 2 : 1, "0"));
                        }
                      }
                    }}
                    className="w-10 rounded-md border border-zinc-200 bg-white py-1 text-center text-xs font-mono font-medium text-zinc-800 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-hidden"
                  />

                  {/* AM/PM Toggle */}
                  <button
                    type="button"
                    onClick={() => setAmpm(ampm === "AM" ? "PM" : "AM")}
                    className={`rounded-md px-2 py-1 text-xs font-semibold cursor-pointer border transition-colors ${
                      ampm === "AM"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-blue-50 border-blue-200 text-blue-700"
                    }`}
                  >
                    {ampm}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSetNow}
              className="text-emerald-700 hover:underline font-medium cursor-pointer"
            >
              Now
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-md bg-[#107548] px-3 py-1 text-xs font-medium text-white hover:bg-[#0d603a] cursor-pointer flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
