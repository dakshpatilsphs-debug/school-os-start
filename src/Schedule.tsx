import React, { useState, useEffect, useCallback } from 'react';
import { FiBookOpen, FiUsers, FiCalendar, FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiRefreshCw, FiEye, FiGrid, FiClock, FiAlertTriangle, FiPrinter, FiDownload, FiSliders, FiShield, FiZap, FiList } from 'react-icons/fi';
import type { Subject, TeacherSubject, TimetableEntry, PeriodSlot, Employee, Student, SubjectConfig } from './types';
import { WEEKDAYS, DEFAULT_PERIODS } from './types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPDFColorsFromSettings } from './PDFHelper';

interface ScheduleSectionProps {
  employees: Employee[];
  students: Student[];
  schoolSettings: any;
  showNotification: (msg: string, type: 'success' | 'error') => void;
  addSubject: (s: any) => Promise<any>;
  getSubjects: () => Promise<any[]>;
  updateSubject: (id: string, d: any) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  saveTeacherSubjects: (teacherId: string, teacherName: string, className: string, subjectIds: string[], subjectNames: string[]) => Promise<any>;
  getTeacherSubjects: () => Promise<any[]>;
  deleteTeacherSubject: (id: string) => Promise<void>;
  saveTimetableEntries: (entries: any[]) => Promise<any[]>;
  getTimetableEntries: () => Promise<any[]>;
  deleteTimetableForClass: (className: string) => Promise<void>;
  deleteTimetableEntry: (id: string) => Promise<void>;
  saveSubjectConfig: (config: any) => Promise<any>;
  getSubjectConfigs: () => Promise<any[]>;
  deleteSubjectConfig: (id: string) => Promise<void>;
}

type ScheduleTab = 'subjects' | 'assign' | 'timetable' | 'settings';

export const ScheduleSection: React.FC<ScheduleSectionProps> = ({
  employees, students, schoolSettings, showNotification,
  addSubject, getSubjects, updateSubject, deleteSubject,
  saveTeacherSubjects, getTeacherSubjects, deleteTeacherSubject,
  saveTimetableEntries, getTimetableEntries, deleteTimetableForClass, deleteTimetableEntry,
  saveSubjectConfig, getSubjectConfigs, deleteSubjectConfig,
}) => {
  const [subTab, setSubTab] = useState<ScheduleTab>('subjects');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Subjects form
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editSubjectId, setEditSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');

  // Assign to Teachers
  const [assignClass, setAssignClass] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [checkedSubjects, setCheckedSubjects] = useState<Set<string>>(new Set());

  // Subject Config (periods per week, doubled)
  const [subjectConfigs, setSubjectConfigs] = useState<SubjectConfig[]>([]);
  const [configClass, setConfigClass] = useState<string>('');
  const [configDirty, setConfigDirty] = useState(false);

  // Timetable
  const SCHEDULE_KEY = 'scheduleSettings';
  const loadScheduleSettings = () => {
    try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '{}'); } catch { return {}; }
  };
  const saved = loadScheduleSettings();
  const [viewMode, setViewMode] = useState<'grid' | 'teacher'>(saved.viewMode || 'grid');
  const [selectedClass, setSelectedClass] = useState(saved.selectedClass || '');
  const [numPeriods, setNumPeriods] = useState(saved.numPeriods || 6);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>(saved.periodSlots || DEFAULT_PERIODS.slice(0, saved.numPeriods || 6));
  const [selectedCell, setSelectedCell] = useState<{ day: string; period: number } | null>(null);
  const [cellSubjectId, setCellSubjectId] = useState('');
  const [cellTeacherId, setCellTeacherId] = useState('');
  const [selectedTeacherView, setSelectedTeacherView] = useState('');
  const [breakAfterPeriod, setBreakAfterPeriod] = useState(saved.breakAfterPeriod ?? 0);
  const [maxDoubledPerDay, setMaxDoubledPerDay] = useState(saved.maxDoubledPerDay ?? 2);
  const [clashReport, setClashReport] = useState<string[]>([]);
  const [scheduleRules, setScheduleRules] = useState<string>(saved.scheduleRules || '');
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ viewMode, selectedClass, numPeriods, periodSlots, breakAfterPeriod, maxDoubledPerDay, scheduleRules }));
  }, [viewMode, selectedClass, numPeriods, periodSlots, breakAfterPeriod, maxDoubledPerDay, scheduleRules]);

  const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
  const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
  const allTeacherSubjects = activeEmployees
    .filter(e => e.role?.toLowerCase().includes('teacher') || e.department?.toLowerCase().includes('teacher'))
    .length > 0
    ? activeEmployees.filter(e => e.role?.toLowerCase().includes('teacher') || e.department?.toLowerCase().includes('teacher'))
    : activeEmployees;

  useEffect(() => { loadSubjects(); loadTeacherSubjects(); loadTimetable(); loadSubjectConfigs(); }, []);

  const loadSubjects = async () => {
    try { const d = await getSubjects(); setSubjects(d as Subject[]); } catch {}
  };
  const loadTeacherSubjects = async () => {
    try { const d = await getTeacherSubjects(); setTeacherSubjects(d as TeacherSubject[]); } catch {}
  };
  const loadTimetable = async () => {
    try { const d = await getTimetableEntries(); setTimetable(d as TimetableEntry[]); } catch {}
  };
  const loadSubjectConfigs = async () => {
    try { const d = await getSubjectConfigs(); setSubjectConfigs(d as SubjectConfig[]); } catch {}
  };

  // ===== Subjects CRUD =====
  const openAddSubject = () => {
    setEditSubjectId(null);
    setSubjectName('');
    setSubjectCode('');
    setSubjectDesc('');
    setShowSubjectForm(true);
  };

  const openEditSubject = (s: Subject) => {
    setEditSubjectId(s.id || null);
    setSubjectName(s.name);
    setSubjectCode(s.code);
    setSubjectDesc(s.description);
    setShowSubjectForm(true);
  };

  const handleSaveSubject = async () => {
    if (!subjectName.trim()) { showNotification('Subject name is required', 'error'); return; }
    const code = subjectCode.trim() || subjectName.trim().substring(0, 4).toUpperCase();
    try {
      if (editSubjectId) {
        await updateSubject(editSubjectId, { name: subjectName.trim().toUpperCase(), code, description: subjectDesc.trim() });
        showNotification('Subject updated', 'success');
      } else {
        await addSubject({ name: subjectName.trim().toUpperCase(), code, description: subjectDesc.trim() });
        showNotification('Subject added', 'success');
      }
      setShowSubjectForm(false);
      loadSubjects();
    } catch { showNotification('Failed to save subject', 'error'); }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    try { await deleteSubject(id); showNotification('Subject deleted', 'success'); loadSubjects(); }
    catch { showNotification('Failed to delete subject', 'error'); }
  };

  // ===== Teacher Subject Assignment =====
  const selectTeacher = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    const ts = teacherSubjects.find(t => t.teacherId === teacherId && t.class === assignClass);
    setCheckedSubjects(new Set(ts?.subjectIds || []));
  };

  const toggleSubject = (subjectId: string) => {
    setCheckedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const handleSaveAssignment = async () => {
    if (!assignClass) { showNotification('Select a class', 'error'); return; }
    if (!selectedTeacherId) { showNotification('Select a teacher', 'error'); return; }
    const emp = activeEmployees.find(e => e.autoId === selectedTeacherId);
    if (!emp) { showNotification('Teacher not found', 'error'); return; }
    const selectedSubjects = subjects.filter(s => checkedSubjects.has(s.id || ''));
    try {
      await saveTeacherSubjects(
        selectedTeacherId,
        emp.name,
        assignClass,
        selectedSubjects.map(s => s.id || ''),
        selectedSubjects.map(s => s.name),
      );
      showNotification('Assignment saved', 'success');
      loadTeacherSubjects();
    } catch { showNotification('Failed to save', 'error'); }
  };

  // ===== Subject Config (periods per week, doubled) =====
  const getConfigForSubject = (subjectId: string): SubjectConfig | undefined =>
    subjectConfigs.find(c => c.class === configClass && c.subjectId === subjectId);

  const updateSubjectConfig = (subjectId: string, subjectName: string, field: 'doubled' | 'allowSameDay' | 'noTeacher' | 'periodsPerWeek', value: boolean | number) => {
    setSubjectConfigs(prev => {
      const existing = prev.findIndex(c => c.class === configClass && c.subjectId === subjectId);
      const updated = [...prev];
      if (existing >= 0) {
        updated[existing] = { ...updated[existing], [field]: value };
      } else {
        updated.push({ class: configClass, subjectId, subjectName, doubled: false, [field]: value });
      }
      return updated;
    });
    setConfigDirty(true);
  };

  const saveAllConfigs = async () => {
    if (!configClass) { showNotification('Select a class', 'error'); return; }
    const classConfigs = subjectConfigs.filter(c => c.class === configClass);
    try {
      for (const cfg of classConfigs) {
        await saveSubjectConfig({
          class: cfg.class,
          subjectId: cfg.subjectId,
          subjectName: cfg.subjectName || '',
          doubled: cfg.doubled ?? false,
          allowSameDay: cfg.allowSameDay ?? false,
          noTeacher: cfg.noTeacher ?? false,
          periodsPerWeek: cfg.periodsPerWeek ?? 0,
        });
      }
      await loadSubjectConfigs();
      setConfigDirty(false);
      showNotification('Subject settings saved', 'success');
    } catch { showNotification('Failed to save settings', 'error'); }
  };

  // ===== Timetable =====
  const getFilteredTimetable = useCallback((cls: string) =>
    timetable.filter(e => e.class === cls), [timetable]);

  const getEntry = useCallback((cls: string, day: string, period: number) =>
    timetable.find(e => e.class === cls && e.day === day && e.period === period), [timetable]);

  const getTeacherConflicts = useCallback((cls: string) => {
    const conflicts = new Set<string>();
    const clsEntries = timetable.filter(e => e.class === cls);
    for (const e1 of clsEntries) {
      const clash = clsEntries.find(e2 =>
        e2.teacherId === e1.teacherId &&
        e2.day === e1.day &&
        e2.period === e1.period &&
        e2.id !== e1.id
      );
      if (clash) conflicts.add(`${e1.day}_${e1.period}`);
    }
    return conflicts;
  }, [timetable]);

  const getAllClashes = useCallback((): string[] => {
    const clashes: string[] = [];
    const classes = [...new Set(timetable.map(e => e.class))];
    for (const cls of classes) {
      const entries = timetable.filter(e => e.class === cls);
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i], b = entries[j];
          if (a.day === b.day && a.period === b.period) {
            if (a.teacherId && b.teacherId && a.teacherId === b.teacherId) {
              clashes.push(`${cls} ${a.day} P${a.period}: Teacher "${a.teacherName}" in two classes`);
            }
            if (a.subjectId === b.subjectId && a.subjectId) {
              clashes.push(`${cls} ${a.day} P${a.period}: Subject "${a.subjectName}" duplicated`);
            }
          }
        }
      }
    }
    return clashes;
  }, [timetable]);

    const handleCheckClashes = () => {
    const c = getAllClashes();
    const emptySlots: string[] = [];
    for (const day of WEEKDAYS) {
      for (let p = 1; p <= numPeriods; p++) {
        if (!timetable.find(e => e.class === selectedClass && e.day === day && e.period === p && e.subjectId)) {
          emptySlots.push(`${day} P${p}`);
        }
      }
    }
    const report = [...c, ...emptySlots.map(s => `${selectedClass}: Empty slot — ${s}`)];
    setClashReport(report);
    if (report.length === 0) showNotification('Timetable is perfect — no clashes, no empty slots', 'success');
    else showNotification(`Found ${c.length} clash(es) and ${emptySlots.length} empty slot(s)`, 'error');
  };

  const handleFixClashesAI = async () => {
    const OPENROUTER_KEY = (import.meta as any).env?.VITE_OPENROUTER_KEY || '';
    const OPENROUTER_MODEL = (import.meta as any).env?.VITE_OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free';
    if (!OPENROUTER_KEY) { showNotification('AI key not configured', 'error'); return; }
    const clashes = getAllClashes();
    const emptySlots: string[] = [];
    const classes = [...new Set(timetable.map(e => e.class))];
    const allClasses = selectedClass ? [selectedClass] : classes;
    for (const cls of allClasses) {
      for (const day of WEEKDAYS) {
        for (let p = 1; p <= numPeriods; p++) {
          if (!timetable.find(e => e.class === cls && e.day === day && e.period === p && e.subjectId)) {
            emptySlots.push(`${cls} ${day} P${p}`);
          }
        }
      }
    }
    if (clashes.length === 0 && emptySlots.length === 0) { showNotification('No clashes and no empty slots', 'success'); return; }
    setLoading(true);
    try {
      const currentTimetable = timetable.map(e => ({
        class: e.class, day: e.day, period: e.period,
        subjectId: e.subjectId, subjectName: e.subjectName,
        teacherId: e.teacherId, teacherName: e.teacherName,
      }));

      // Build full grid showing ALL slots (filled or EMPTY)
      const fullGrid: Array<{ class: string; day: string; period: number; subjectId: string; subjectName: string; teacherId: string; teacherName: string }> = [];
      for (const cls of allClasses) {
        for (const day of WEEKDAYS) {
          for (let p = 1; p <= numPeriods; p++) {
            const entry = currentTimetable.find(e => e.class === cls && e.day === day && e.period === p);
            if (entry) {
              fullGrid.push(entry);
            } else {
              fullGrid.push({ class: cls, day, period: p, subjectId: 'EMPTY', subjectName: 'EMPTY', teacherId: '', teacherName: '' });
            }
          }
        }
      }

      const teacherList = activeEmployees.map(e => ({ id: e.autoId, name: e.name, role: e.role }));
      const subjectList = subjects.map(s => ({ id: s.id || '', name: s.name }));
      const teacherSubjectPairs = teacherSubjects.filter(ts => allClasses.includes(ts.class)).map(ts => ({
        class: ts.class, teacherId: ts.teacherId, teacherName: ts.teacherName,
        subjectIds: ts.subjectIds, subjectNames: ts.subjectNames,
      }));

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}` },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: `You are a timetable resolver. Fix clashes AND fill empty slots.

Return ONLY a JSON array of changes. Each change: { "class": string, "day": string, "period": number, "newSubjectId": string, "newSubjectName": string, "newTeacherId": string, "newTeacherName": string }

Rules:
- Fix teacher conflicts (same teacher in two classes same time)
- Fill ALL empty slots with appropriate subjects and teachers
- A teacher can only teach one class at a time per period
- Use the teacher-subject assignments to know which teacher teaches which subject
- For empty slots: pick a subject+teacher pair that is not already occupied at that time
- If a subject has no assigned teacher, use empty string "" for teacherId and teacherName
- Ensure every class has every period filled (no empty cells)
- Return changes for both fixes and fills
${scheduleRules ? `\nUser-defined scheduling rules:\n${scheduleRules}\n` : ''}` },
            { role: 'user', content: `Clashes:\n${clashes.length > 0 ? clashes.join('\n') : 'None'}\n\nEmpty Slots to fill:\n${emptySlots.length > 0 ? emptySlots.join('\n') : 'None'}\n\nFULL TIMETABLE GRID (every cell — slots marked "EMPTY" must be filled):\n${JSON.stringify(fullGrid)}\n\nTeacher-Subject Assignments:\n${JSON.stringify(teacherSubjectPairs)}\n\nTeachers:\n${teacherList.map(t => `${t.id}: ${t.name} (${t.role})`).join('\n')}\n\nSubjects:\n${subjectList.map(s => `${s.id}: ${s.name}`).join('\n')}\n\nMax periods per day: ${numPeriods}\nBreak after period: ${breakAfterPeriod || 'None'}\n\nIMPORTANT: Every slot with subjectId="EMPTY" MUST have a change entry in your response. Do NOT skip any EMPTY slot.` }
          ],
          temperature: 0.1,
          max_tokens: 8000,
        }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Invalid AI response');
      const fixes = JSON.parse(jsonMatch[0]) as Array<{ class: string; day: string; period: number; newSubjectId: string; newSubjectName: string; newTeacherId: string; newTeacherName: string }>;

      for (const fix of fixes) {
        const existing = timetable.find(e => e.class === fix.class && e.day === fix.day && e.period === fix.period);
        if (existing?.id) await deleteTimetableEntry(existing.id);
        const slot = periodSlots[fix.period - 1];
        await saveTimetableEntries([{
          class: fix.class, day: fix.day, period: fix.period,
          subjectId: fix.newSubjectId, subjectName: fix.newSubjectName,
          teacherId: fix.newTeacherId, teacherName: fix.newTeacherName,
          startTime: slot?.startTime || '', endTime: slot?.endTime || '',
        }]);
      }
      await loadTimetable();
      const remaining = getAllClashes();
      setClashReport(remaining);
      showNotification(`AI applied ${fixes.length} change(s) — ${remaining.length} clash(es) remaining`, remaining.length === 0 ? 'success' : 'error');
    } catch { showNotification('AI fix failed', 'error'); }
    setLoading(false);
  };

  const updatePeriodSlots = (n: number) => {
    setNumPeriods(n);
    setPeriodSlots(DEFAULT_PERIODS.slice(0, n));
  };

  const updateSlotTime = (idx: number, field: 'startTime' | 'endTime', val: string) => {
    setPeriodSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const handleAutoGenerate = async () => {
    if (!selectedClass) { showNotification('Select a class', 'error'); return; }
    setLoading(true);
    try {
      const pairMap = new Map<string, { subjectId: string; subjectName: string; teacherId: string; teacherName: string }>();
      for (const ts of teacherSubjects) {
        if (ts.class !== selectedClass) continue;
        for (let i = 0; i < ts.subjectIds.length; i++) {
          const sid = ts.subjectIds[i];
          const s = subjects.find(sub => sub.id === sid);
          if (s) pairMap.set(sid, { subjectId: sid, subjectName: ts.subjectNames[i] || s.name, teacherId: ts.teacherId, teacherName: ts.teacherName });
        }
      }
      const pairs = Array.from(pairMap.values());
      if (pairs.length === 0) { showNotification('No subjects assigned to teachers', 'error'); setLoading(false); return; }

      const filledSlots = new Set<string>();
      const entries: any[] = [];
      const subjectWeekCount = new Map<string, number>();
      const subjectDayCount = new Map<string, number>();

      const breakSlot = breakAfterPeriod > 0 ? breakAfterPeriod : -1;

      const doPlace = (subjectId: string, subjectName: string, teacherId: string, teacherName: string, day: string, p: number, span: number) => {
        if (span === 2 && breakSlot > 0 && p === breakSlot) return false;
        if (span === 2) {
          const nextKey = `${day}_${p + 1}`;
          if (filledSlots.has(nextKey) || p + 1 > numPeriods) return false;
          const slot = periodSlots[p - 1];
          const nextSlot = periodSlots[p];
          entries.push({ class: selectedClass, day, period: p, subjectId, subjectName, teacherId, teacherName, startTime: slot.startTime, endTime: slot.endTime });
          entries.push({ class: selectedClass, day, period: p + 1, subjectId, subjectName, teacherId, teacherName, startTime: nextSlot.startTime, endTime: nextSlot.endTime });
          filledSlots.add(`${day}_${p}`);
          filledSlots.add(nextKey);
          return true;
        }
        if (filledSlots.has(`${day}_${p}`)) return false;
        const slot = periodSlots[p - 1];
        entries.push({ class: selectedClass, day, period: p, subjectId, subjectName, teacherId, teacherName, startTime: slot.startTime, endTime: slot.endTime });
        filledSlots.add(`${day}_${p}`);
        return true;
      };

      // Classify subjects
      const doubledSubjects: typeof pairs = [];
      const regularSubjects: typeof pairs = [];
      const noTeacherSubjects: Array<{ subjectId: string; subjectName: string }> = [];

      for (const pair of pairs) {
        const cfg = subjectConfigs.find(c => c.class === selectedClass && c.subjectId === pair.subjectId);
        if (cfg?.noTeacher) noTeacherSubjects.push({ subjectId: pair.subjectId, subjectName: pair.subjectName });
        else if (cfg?.doubled) doubledSubjects.push({ ...pair });
        else regularSubjects.push({ ...pair });
      }

      // Available periods
      const getAvailablePeriods = (day: string) => {
        const periods: number[] = [];
        for (let p = 1; p <= numPeriods; p++) {
          if (!filledSlots.has(`${day}_${p}`)) periods.push(p);
        }
        return periods.sort(() => Math.random() - 0.5);
      };

      // After-break periods for doubled lectures
      const getAfterBreakPeriods = (day: string) => {
        const periods: number[] = [];
        for (let p = (breakSlot > 0 ? breakSlot + 1 : 1); p <= numPeriods; p++) {
          if (!filledSlots.has(`${day}_${p}`)) periods.push(p);
        }
        return periods.sort(() => Math.random() - 0.5);
      };

      // Step 1: Place doubled lectures (max maxDoubledPerDay different doubled subjects per day, after break)
      const doubledCycle = [...doubledSubjects].sort(() => Math.random() - 0.5);
      for (const day of WEEKDAYS) {
        let placed = 0;
        for (const ds of doubledCycle) {
          if (placed >= maxDoubledPerDay) break;
          const weekKey = ds.subjectId;
          const weekCount = subjectWeekCount.get(weekKey) || 0;
          const cfg = subjectConfigs.find(c => c.class === selectedClass && c.subjectId === ds.subjectId);
          const maxPerWeek = cfg?.periodsPerWeek && cfg.periodsPerWeek > 0 ? cfg.periodsPerWeek : numPeriods * WEEKDAYS.length;
          if (weekCount >= maxPerWeek) continue;

          const afterBreak = getAfterBreakPeriods(day);
          for (let i = 0; i < afterBreak.length - 1; i++) {
            const p = afterBreak[i];
            if (doPlace(ds.subjectId, ds.subjectName, ds.teacherId, ds.teacherName, day, p, 2)) {
              subjectWeekCount.set(weekKey, weekCount + 2);
              subjectDayCount.set(`${ds.subjectId}_${day}`, (subjectDayCount.get(`${ds.subjectId}_${day}`) || 0) + 2);
              placed++;
              break;
            }
          }
        }
      }

      // Step 2: Place regular + noTeacher subjects, respecting periodsPerWeek
      const fillPool: Array<{ subjectId: string; subjectName: string; teacherId: string; teacherName: string; isNoTeacher?: boolean }> = [
        ...regularSubjects.map(s => ({ ...s })),
        ...noTeacherSubjects.map(s => ({ ...s, teacherId: '', teacherName: '', isNoTeacher: true })),
      ].sort(() => Math.random() - 0.5);

      for (const day of WEEKDAYS) {
        const available = getAvailablePeriods(day);
        for (const p of available) {
          if (filledSlots.has(`${day}_${p}`)) continue;
          let placed = false;
          for (const sub of fillPool) {
            const weekKey = sub.subjectId;
            const weekCount = subjectWeekCount.get(weekKey) || 0;
            const dayCount = subjectDayCount.get(`${sub.subjectId}_${day}`) || 0;
            const cfg = subjectConfigs.find(c => c.class === selectedClass && c.subjectId === sub.subjectId);
            const maxPerWeek = cfg?.periodsPerWeek && cfg.periodsPerWeek > 0 ? cfg.periodsPerWeek : numPeriods * WEEKDAYS.length;
            if (weekCount >= maxPerWeek) continue;
            if (dayCount >= 2) continue;

            if (doPlace(sub.subjectId, sub.subjectName, sub.teacherId, sub.teacherName, day, p, 1)) {
              subjectWeekCount.set(weekKey, weekCount + 1);
              subjectDayCount.set(`${sub.subjectId}_${day}`, dayCount + 1);
              placed = true;
              break;
            }
          }
        }
      }

      // Step 3: Force-fill remaining empty slots — cycle through all subjects (no cap)
      const allPool: Array<{ subjectId: string; subjectName: string; teacherId: string; teacherName: string }> = [
        ...noTeacherSubjects.map(s => ({ ...s, teacherId: '', teacherName: '' })),
        ...regularSubjects.map(s => ({ ...s })),
        ...doubledSubjects.map(s => ({ ...s })),
      ].sort(() => Math.random() - 0.5);

      for (const day of WEEKDAYS) {
        for (let p = 1; p <= numPeriods; p++) {
          if (filledSlots.has(`${day}_${p}`)) continue;
          for (const sub of allPool) {
            if (doPlace(sub.subjectId, sub.subjectName, sub.teacherId, sub.teacherName, day, p, 1)) {
              subjectWeekCount.set(sub.subjectId, (subjectWeekCount.get(sub.subjectId) || 0) + 1);
              subjectDayCount.set(`${sub.subjectId}_${day}`, (subjectDayCount.get(`${sub.subjectId}_${day}`) || 0) + 1);
              break;
            }
          }
        }
      }

      await deleteTimetableForClass(selectedClass);
      await saveTimetableEntries(entries);
      await loadTimetable();
      showNotification('Timetable generated', 'success');
    } catch { showNotification('Failed to generate timetable', 'error'); }
    setLoading(false);
  };

  const handleCellClick = (day: string, period: number) => {
    const existing = getEntry(selectedClass, day, period);
    setSelectedCell({ day, period });
    setCellSubjectId(existing?.subjectId || '');
    setCellTeacherId(existing?.teacherId || '');
  };

  const handleCellSave = async () => {
    if (!selectedCell || !selectedClass) return;
    const slot = periodSlots[selectedCell.period - 1];
    const existing = getEntry(selectedClass, selectedCell.day, selectedCell.period);
    const teacher = activeEmployees.find(e => e.autoId === cellTeacherId);
    const subject = subjects.find(s => s.id === cellSubjectId);
    try {
      if (existing?.id) await deleteTimetableEntry(existing.id);
      if (cellSubjectId && cellTeacherId) {
        await saveTimetableEntries([{
          class: selectedClass,
          day: selectedCell.day,
          period: selectedCell.period,
          subjectId: cellSubjectId,
          subjectName: subject?.name || '',
          teacherId: cellTeacherId,
          teacherName: teacher?.name || '',
          startTime: slot?.startTime || '',
          endTime: slot?.endTime || '',
        }]);
      }
      await loadTimetable();
      setSelectedCell(null);
      showNotification('Cell updated', 'success');
    } catch { showNotification('Failed to update cell', 'error'); }
  };

  const handleCellClear = async () => {
    if (!selectedCell || !selectedClass) return;
    const existing = getEntry(selectedClass, selectedCell.day, selectedCell.period);
    if (existing?.id) {
      try { await deleteTimetableEntry(existing.id); await loadTimetable(); } catch {}
    }
    setSelectedCell(null);
  };

  const clearTimetable = async () => {
    if (!selectedClass || !confirm(`Clear timetable for ${selectedClass}?`)) return;
    try { await deleteTimetableForClass(selectedClass); await loadTimetable(); showNotification('Timetable cleared', 'success'); }
    catch { showNotification('Failed to clear', 'error'); }
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = () => {
    if (!selectedClass) { showNotification('Select a class first', 'error'); return; }
    try {
      const doc = new jsPDF();
      const pw = 210, ph = 297;
      const c = getPDFColorsFromSettings(schoolSettings);
      const s = schoolSettings;

      // === Header band ===
      doc.setFillColor(...c.primary);
      doc.rect(0, 0, pw, 24, 'F');

      let textX = 10;
      if (s.schoolLogo) {
        try {
          const lw = Math.min(s.pdfLogoWidth ? s.pdfLogoWidth * 0.4 : 16, 18);
          const lh = Math.min(s.pdfLogoHeight ? s.pdfLogoHeight * 0.4 : 16, 18);
          doc.addImage(s.schoolLogo, 'PNG', 10, (24 - lh) / 2, lw, lh);
          textX = 10 + lw + 4;
        } catch (_) {}
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text((s.schoolName || 'School OS').toUpperCase(), textX, 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(s.pdfBodySize || 10);
      doc.text(`Timetable - ${selectedClass}`, textX, 17);
      doc.setFontSize(7.5);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(dateStr, pw - 10, 10, { align: 'right' });

      // === Timetable table via autoTable ===
      const headerRow = ['Period', ...WEEKDAYS.map(d => d.substring(0, 3))];
      const bodyRows: string[][] = [];

      for (let p = 1; p <= numPeriods; p++) {
        if (breakAfterPeriod > 0 && p === breakAfterPeriod + 1) {
          bodyRows.push(['--- BREAK ---', ...WEEKDAYS.map(() => '')]);
        }
        const slot = periodSlots[p - 1];
        const periodLabel = slot ? `P${p}\n${slot.startTime}-${slot.endTime}` : `P${p}`;
        const row: string[] = [periodLabel];
        for (const day of WEEKDAYS) {
          const entry = timetable.find(e => e.class === selectedClass && e.day === day && e.period === p);
          if (entry && entry.subjectId) {
            row.push(`${entry.subjectName}\n${entry.teacherName}`);
          } else {
            row.push('');
          }
        }
        bodyRows.push(row);
      }

      autoTable(doc, {
        startY: 30,
        head: [headerRow],
        body: bodyRows,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'center',
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 7.5,
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 18, fontStyle: 'bold', fontSize: 8, textColor: [100, 116, 139] },
        },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.3,
      });

      // === Footer ===
      const ft = s.pdfFooterText || '';
      const finalY = (doc as any).lastAutoTable?.finalY || 260;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(10, ph - 14, pw - 10, ph - 14);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(ft ? `${s.schoolName || 'School OS'}  |  ${ft}` : `${s.schoolName || 'School OS'}  |  ${dateStr}`, 10, ph - 9);
      doc.text('Page 1 of 1', pw - 10, ph - 9, { align: 'right' });

      doc.save(`Timetable_${selectedClass.replace(/\s+/g, '_')}.pdf`);
      showNotification('Timetable PDF downloaded', 'success');
    } catch (e) { console.error(e); showNotification('Failed to generate PDF', 'error'); }
  };

  const subTabs: { id: ScheduleTab; label: string; icon: React.FC<any> }[] = [
    { id: 'subjects', label: 'Subjects', icon: FiBookOpen },
    { id: 'assign', label: 'Assign to Teachers', icon: FiUsers },
    { id: 'settings', label: 'Subject Settings', icon: FiSliders },
    { id: 'timetable', label: 'Timetable', icon: FiCalendar },
  ];

  const isTeacher = (e: Employee) =>
    e.role?.toLowerCase().includes('teacher') ||
    e.department?.toLowerCase().includes('teacher');

  const teacherEmployees = activeEmployees.filter(e => isTeacher(e));
  const displayTeachers = teacherEmployees.length > 0 ? teacherEmployees : activeEmployees;

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-2 flex gap-1">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${subTab === t.id ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== SUBJECTS TAB ===== */}
      {subTab === 'subjects' && (
        <div className="space-y-4">
          <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2"><FiBookOpen className="text-cyan-400" /> Manage Subjects</h3>
                <p className="text-xs text-gray-400 mt-1">Create and manage all school subjects</p>
              </div>
              <button onClick={openAddSubject} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-5 py-2.5 rounded-xl font-semibold transition shadow-lg shadow-cyan-500/20">
                <FiPlus size={16} /> Add Subject
              </button>
            </div>

            {showSubjectForm && (
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Subject Name *</label>
                    <input value={subjectName} onChange={e => { setSubjectName(e.target.value.toUpperCase()); if (!editSubjectId && !subjectCode) setSubjectCode(e.target.value.substring(0, 4).toUpperCase()); }} placeholder="e.g. MATHEMATICS" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Code</label>
                    <input value={subjectCode} onChange={e => setSubjectCode(e.target.value.toUpperCase())} placeholder="Auto-filled" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Description</label>
                    <input value={subjectDesc} onChange={e => setSubjectDesc(e.target.value)} placeholder="Optional" className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowSubjectForm(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition">Cancel</button>
                  <button onClick={handleSaveSubject} className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white rounded-lg font-semibold text-sm transition">
                    <FiSave size={14} /> {editSubjectId ? 'Update' : 'Add'} Subject
                  </button>
                </div>
              </div>
            )}

            {subjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FiBookOpen size={48} className="mx-auto mb-3 opacity-30" />
                <p>No subjects yet. Click "Add Subject" to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 hidden md:table-cell">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(s => (
                      <tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                        <td className="px-4 py-3 font-semibold text-sm">{s.name}</td>
                        <td className="px-4 py-3"><span className="bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded text-xs font-mono">{s.code}</span></td>
                        <td className="px-4 py-3 text-gray-400 text-sm hidden md:table-cell">{s.description || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => openEditSubject(s)} className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="Edit"><FiEdit2 size={14} /></button>
                            <button onClick={() => s.id && handleDeleteSubject(s.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Delete"><FiTrash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ASSIGN TO TEACHERS TAB ===== */}
      {subTab === 'assign' && (
        <div className="space-y-4">
          <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><FiUsers className="text-cyan-400" /> Assign Subjects to Teachers</h3>
            <p className="text-xs text-gray-400 mb-6">Select a class and teacher, then check the subjects they teach.</p>

            {/* Class Selector */}
            <div className="max-w-xs mb-6">
              <label className="text-xs text-gray-400 block mb-1">Class *</label>
              <select value={assignClass} onChange={e => { setAssignClass(e.target.value); setSelectedTeacherId(''); setCheckedSubjects(new Set()); }} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                <option value="">-- Select Class --</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {!assignClass ? (
              <div className="text-center py-12 text-gray-500">
                <FiUsers size={48} className="mx-auto mb-3 opacity-30" />
                <p>Select a class to begin assigning subjects to teachers</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Teacher List */}
                <div className="lg:col-span-2 space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                  {displayTeachers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No teachers found</p>
                  ) : displayTeachers.map(e => {
                    const ts = teacherSubjects.find(t => t.teacherId === e.autoId && t.class === assignClass);
                    const count = ts?.subjectIds.length || 0;
                    return (
                      <button
                        key={e.autoId}
                        onClick={() => selectTeacher(e.autoId)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${selectedTeacherId === e.autoId ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'}`}
                      >
                        <p className="font-semibold text-sm">{e.name}</p>
                        <p className="text-xs text-gray-400">{e.role || e.department || 'Teacher'} &middot; {count} subject{count !== 1 ? 's' : ''} for {assignClass}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Subject Checklist */}
                <div className="lg:col-span-3">
                  {!selectedTeacherId ? (
                    <div className="text-center py-16 text-gray-500">
                      <FiUsers size={48} className="mx-auto mb-3 opacity-30" />
                      <p>Select a teacher from the left panel</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold mb-3 text-cyan-400">
                        {activeEmployees.find(e => e.autoId === selectedTeacherId)?.name} — Subjects for {assignClass}
                      </p>
                      {subjects.length === 0 ? (
                        <p className="text-gray-500 text-sm">No subjects available. Create subjects first.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          {subjects.map(s => (
                            <label
                              key={s.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${checkedSubjects.has(s.id || '') ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checkedSubjects.has(s.id || '')}
                                onChange={() => toggleSubject(s.id || '')}
                                className="w-4 h-4 accent-emerald-500"
                              />
                              <div>
                                <p className="text-sm font-semibold">{s.name}</p>
                                <p className="text-xs text-gray-400">{s.code}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <button onClick={handleSaveAssignment} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-6 py-2.5 rounded-xl font-semibold transition shadow-lg shadow-cyan-500/20">
                          <FiSave size={16} /> Save Assignment
                        </button>
                        <button onClick={() => { setSelectedTeacherId(''); setCheckedSubjects(new Set()); }} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition">
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SUBJECT SETTINGS TAB ===== */}
      {subTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2"><FiSliders className="text-cyan-400" /> Subject Settings</h3>
                <p className="text-xs text-gray-400 mt-1">Configure periods per week and double periods for each subject per class</p>
              </div>
              {configClass && (
                <button onClick={saveAllConfigs} disabled={!configDirty} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition shadow-lg ${configDirty ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white shadow-emerald-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                  <FiSave size={16} /> Save Settings
                </button>
              )}
            </div>

            {/* Class Selector */}
            <div className="max-w-xs mb-6">
              <label className="text-xs text-gray-400 block mb-1">Class *</label>
              <select value={configClass} onChange={e => { setConfigClass(e.target.value); setConfigDirty(false); }} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                <option value="">-- Select Class --</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {!configClass ? (
              <div className="text-center py-12 text-gray-500">
                <FiSliders size={48} className="mx-auto mb-3 opacity-30" />
                <p>Select a class to configure subject settings</p>
              </div>
            ) : (
              <div>
                {/* Get subjects assigned to this class via teacherSubjects */}
                {(() => {
                  const classSubjectIds = new Set<string>();
                  const classSubjectMap: Record<string, string> = {};
                  for (const ts of teacherSubjects) {
                    if (ts.class !== configClass) continue;
                    for (let i = 0; i < ts.subjectIds.length; i++) {
                      classSubjectIds.add(ts.subjectIds[i]);
                      const sub = subjects.find(s => s.id === ts.subjectIds[i]);
                      classSubjectMap[ts.subjectIds[i]] = ts.subjectNames[i] || sub?.name || ts.subjectIds[i];
                    }
                  }
                  const assignedSubjects = subjects.filter(s => s.id);

                  if (assignedSubjects.length === 0) {
                    return <div className="text-center py-12 text-gray-500"><p>No subjects found. Create subjects first.</p></div>;
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-800/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Subject</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400">Periods / Week</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400">Double Period</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedSubjects.map(s => {
                            const cfg = getConfigForSubject(s.id!);
                            return (
                              <tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                                <td className="px-4 py-3 font-semibold text-sm">{classSubjectMap[s.id!] || s.name}</td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={numPeriods * WEEKDAYS.length}
                                    value={cfg?.periodsPerWeek ?? 0}
                                    onChange={e => updateSubjectConfig(s.id!, classSubjectMap[s.id!] || s.name, 'periodsPerWeek', parseInt(e.target.value) || 0)}
                                    className="w-20 p-1.5 bg-gray-800 border border-gray-700 rounded text-center text-sm text-white"
                                    title="0 = auto (fill remaining slots)"
                                  />
                                  <p className="text-[10px] text-gray-500 mt-0.5">0 = auto</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <label className="flex items-center gap-2 cursor-pointer justify-center">
                                    <input
                                      type="checkbox"
                                      checked={cfg?.doubled ?? false}
                                      onChange={e => updateSubjectConfig(s.id!, classSubjectMap[s.id!] || s.name, 'doubled', e.target.checked)}
                                      className="w-4 h-4 accent-cyan-500"
                                    />
                                    <span className={`text-xs font-semibold ${cfg?.doubled ? 'text-cyan-400' : 'text-gray-500'}`}>
                                      {cfg?.doubled ? 'Yes' : 'No'}
                                    </span>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="text-xs text-gray-500 mt-4">
                        "Periods / Week" = how many times this subject appears per week (0 = auto-fill remaining).
                        "Double Period" = two consecutive periods, placed after the break (max {maxDoubledPerDay}/day).
                      </p>

                      {/* No Teacher Subjects section */}
                      <div className="mt-6 pt-4 border-t border-gray-800">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">No Teacher Subjects</h4>
                        <p className="text-xs text-gray-500 mb-3">Select subjects that fill remaining slots without a teacher.</p>
                        <div className="flex flex-wrap gap-3">
                          {subjects.filter(s => s.id).map(s => {
                            const cfg = getConfigForSubject(s.id!);
                            const isNoTeacher = cfg?.noTeacher === true;
                            return (
                              <label key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition border ${isNoTeacher ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-gray-800/50 border-gray-700/30 hover:border-gray-600'}`}>
                                <input
                                  type="checkbox"
                                  checked={isNoTeacher}
                                  onChange={e => updateSubjectConfig(s.id!, s.name || classSubjectMap[s.id!] || '', 'noTeacher', e.target.checked)}
                                  className="w-4 h-4 accent-cyan-500"
                                />
                                <span className="text-sm font-medium">{classSubjectMap[s.id!] || s.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TIMETABLE TAB ===== */}
      {subTab === 'timetable' && (
        <div className="space-y-4">
          <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2"><FiCalendar className="text-cyan-400" /> Timetable</h3>
                <p className="text-xs text-gray-400 mt-1">Auto-generate and edit weekly timetables</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewMode('grid')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${viewMode === 'grid' ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  <FiGrid size={14} /> Class Grid
                </button>
                <button onClick={() => setViewMode('teacher')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${viewMode === 'teacher' ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  <FiEye size={14} /> Teacher View
                </button>
              </div>
            </div>

            {/* ===== CLASS GRID VIEW ===== */}
            {viewMode === 'grid' && (
              <>
                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Class</label>
                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                      <option value="">-- Select Class --</option>
                      {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Periods / Day</label>
                    <select value={numPeriods} onChange={e => updatePeriodSlots(parseInt(e.target.value))} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                      {[4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} periods</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Break After Period</label>
                    <select value={breakAfterPeriod} onChange={e => setBreakAfterPeriod(parseInt(e.target.value))} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                      <option value={0}>No Break</option>
                      {Array.from({ length: numPeriods - 1 }, (_, i) => i + 1).map(n => <option key={n} value={n}>After P{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Max Doubled / Day</label>
                    <select value={maxDoubledPerDay} onChange={e => setMaxDoubledPerDay(parseInt(e.target.value))} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                      {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button onClick={handleAutoGenerate} disabled={loading} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-purple-500/20 disabled:opacity-50">
                      <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Generating...' : 'Auto Generate'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  <button onClick={clearTimetable} className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition border border-gray-700">
                    <FiTrash2 size={16} />
                  </button>
                  {selectedClass && <>
                    <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition border border-gray-700">
                      <FiDownload size={16} /> PDF
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition border border-gray-700">
                      <FiPrinter size={16} /> Print
                    </button>
                  </>}
                  <button onClick={handleCheckClashes} disabled={!selectedClass} className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/50 text-amber-400 hover:bg-amber-500/20 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                    <FiShield size={16} /> Check Clashes & Empty
                  </button>
                  <button onClick={handleFixClashesAI} disabled={loading || !selectedClass} className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-amber-500/20 disabled:opacity-50">
                    <FiZap size={16} /> {loading ? 'Fixing...' : 'AI Fix All'}
                  </button>
                  <button onClick={() => setShowRulesModal(true)} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition border ${scheduleRules.trim() ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                    <FiList size={16} /> Schedule Rules {scheduleRules.trim() ? '(Active)' : ''}
                  </button>
                </div>

                {clashReport.length > 0 && (
                  <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-4 mb-6">
                    <p className="text-sm font-bold text-red-400 mb-2 flex items-center gap-2"><FiAlertTriangle size={14} /> Clash Report ({clashReport.length})</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {clashReport.map((c, i) => <p key={i} className="text-xs text-red-300">{c}</p>)}
                    </div>
                  </div>
                )}

                {/* Period Times Editor */}
                <div className="bg-gray-800/30 rounded-xl border border-gray-700 p-4 mb-6">
                  <p className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2"><FiClock size={12} /> Period Times</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                    {periodSlots.map((slot, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-2">
                        <p className="text-xs text-cyan-400 font-semibold mb-1">P{i + 1}</p>
                        <input value={slot.startTime} onChange={e => updateSlotTime(i, 'startTime', e.target.value)} className="w-full p-1 bg-gray-700 rounded text-xs text-white text-center" type="time" />
                        <span className="text-xs text-gray-500 block text-center">to</span>
                        <input value={slot.endTime} onChange={e => updateSlotTime(i, 'endTime', e.target.value)} className="w-full p-1 bg-gray-700 rounded text-xs text-white text-center" type="time" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timetable Grid */}
                {selectedClass ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse">
                      <thead>
                        <tr>
                          <th className="p-3 text-xs font-semibold text-gray-400 bg-gray-800/50 border border-gray-700 w-16">Period</th>
                          {WEEKDAYS.map(day => (
                            <th key={day} className="p-3 text-xs font-semibold text-gray-400 bg-gray-800/50 border border-gray-700">{day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: numPeriods }, (_, pi) => pi + 1).map(p => {
                          const conflicts = getTeacherConflicts(selectedClass);
                          return (
                            <React.Fragment key={p}>
                              {breakAfterPeriod > 0 && p === breakAfterPeriod + 1 && (
                                <tr>
                                  <td colSpan={WEEKDAYS.length + 1} className="p-1 bg-amber-500/10 border border-amber-500/20">
                                    <div className="text-center text-[10px] font-bold text-amber-400 tracking-widest">BREAK</div>
                                  </td>
                                </tr>
                              )}
                              <tr>
                              <td className="p-2 text-xs text-center text-gray-500 font-mono border border-gray-800 bg-gray-800/30">
                                <div className="text-cyan-400 font-bold">{p}</div>
                                <div className="text-[10px] text-gray-500">{periodSlots[p - 1]?.startTime}-{periodSlots[p - 1]?.endTime}</div>
                              </td>
                              {WEEKDAYS.map(day => {
                                const entry = getEntry(selectedClass, day, p);
                                const isConflict = conflicts.has(`${day}_${p}`);
                                const isSelected = selectedCell?.day === day && selectedCell?.period === p;
                                const isEmpty = !entry || !entry.subjectId;
                                return (
                                  <td
                                    key={day}
                                    onClick={() => handleCellClick(day, p)}
                                    className={`p-2 border border-gray-800 cursor-pointer transition-all relative ${isSelected ? 'ring-2 ring-cyan-500' : ''} ${isEmpty ? 'hover:bg-gray-800/50' : 'hover:bg-gray-800/30'}`}
                                  >
                                    {isSelected && selectedCell ? (
                                      <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                                        <select value={cellSubjectId} onChange={e => setCellSubjectId(e.target.value)} className="w-full p-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white">
                                          <option value="">-- Subject --</option>
                                          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <select value={cellTeacherId} onChange={e => setCellTeacherId(e.target.value)} className="w-full p-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white">
                                          <option value="">-- Teacher --</option>
                                          {displayTeachers.map(e => <option key={e.autoId} value={e.autoId}>{e.name}</option>)}
                                        </select>
                                        <div className="flex gap-1">
                                          <button onClick={handleCellSave} className="flex-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-white rounded text-xs font-semibold"><FiSave size={12} /></button>
                                          <button onClick={handleCellClear} className="px-2 py-1 bg-red-500 hover:bg-red-400 text-white rounded text-xs font-semibold"><FiX size={12} /></button>
                                        </div>
                                      </div>
                                    ) : isEmpty ? (
                                      <div className="text-center py-3">
                                        <span className="text-gray-600 text-xs">Empty</span>
                                      </div>
                                    ) : (
                                      <div className="text-center">
                                        <div className="text-xs font-bold text-white truncate">{entry?.subjectName}</div>
                                        <div className="text-[10px] text-gray-400 truncate">{entry?.teacherName}</div>
                                        {isConflict && (
                                          <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" title="Teacher conflict detected">
                                            <FiAlertTriangle size={10} className="text-white" />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <FiCalendar size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Select a class to view or generate timetable</p>
                  </div>
                )}
              </>
            )}

            {/* ===== TEACHER VIEW ===== */}
            {viewMode === 'teacher' && (
              <div className="space-y-4">
                <div className="max-w-xs">
                  <label className="text-xs text-gray-400 block mb-1">Select Teacher</label>
                  <select value={selectedTeacherView} onChange={e => setSelectedTeacherView(e.target.value)} className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm">
                    <option value="">-- Select Teacher --</option>
                    {displayTeachers.map(e => (
                      <option key={e.autoId} value={e.autoId}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {selectedTeacherView ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse">
                      <thead>
                        <tr>
                          <th className="p-3 text-xs font-semibold text-gray-400 bg-gray-800/50 border border-gray-700">Day</th>
                          {Array.from({ length: numPeriods }, (_, i) => (
                            <th key={i} className="p-3 text-xs font-semibold text-gray-400 bg-gray-800/50 border border-gray-700">
                              P{i + 1}<br /><span className="text-[10px] font-normal">{periodSlots[i]?.startTime}-{periodSlots[i]?.endTime}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {WEEKDAYS.map(day => {
                          const dayEntries = timetable.filter(e =>
                            e.teacherId === selectedTeacherView && e.day === day
                          );
                          return (
                            <tr key={day}>
                              <td className="p-3 text-xs font-semibold text-gray-300 border border-gray-800 bg-gray-800/30">{day}</td>
                              {Array.from({ length: numPeriods }, (_, i) => {
                                const p = i + 1;
                                const entry = dayEntries.find(e => e.period === p);
                                return (
                                  <td key={p} className={`p-2 border border-gray-800 text-center ${entry ? 'bg-emerald-500/5' : ''}`}>
                                    {entry ? (
                                      <div>
                                        <div className="text-xs font-bold text-cyan-400">{entry.subjectName}</div>
                                        <div className="text-[10px] text-gray-400">{entry.class}</div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-600 text-xs">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <FiEye size={48} className="mx-auto mb-3 opacity-30" />
                    <p>Select a teacher to view their schedule</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SCHEDULE RULES MODAL ===== */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowRulesModal(false)}>
          <div className="bg-[#1E1E1E] rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><FiList className="text-cyan-400" /> Schedule Rules for AI</h3>
                <p className="text-xs text-gray-400 mt-1">Add custom rules and constraints the AI must follow when fixing and generating schedules</p>
              </div>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white"><FiX size={20} /></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <textarea
                value={scheduleRules}
                onChange={e => setScheduleRules(e.target.value)}
                placeholder={`Example rules:\n- Math should not be scheduled after lunch break\n- PE should only be on Monday, Wednesday, Friday\n- English and Hindi should not be in the same day\n- Science doubled periods must be in the morning\n- No teacher should teach more than 4 periods in a day\n- Arts/Music should be last period of the day\n- Teacher Mr. Khan is only available Mon-Wed\n- Keep hard subjects (Math, Science) in the morning slots\n- Friday afternoon should be activities/free period`}
                className="w-full h-64 p-4 bg-gray-800 rounded-xl border border-gray-700 text-white text-sm resize-none focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between p-5 border-t border-gray-800">
              <p className="text-xs text-gray-500">{scheduleRules.trim() ? `${scheduleRules.split('\n').filter(l => l.trim()).length} rule(s) active` : 'No rules set — AI uses default logic'}</p>
              <div className="flex gap-2">
                <button onClick={() => setScheduleRules('')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition">Clear Rules</button>
                <button onClick={() => setShowRulesModal(false)} className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg font-semibold text-sm transition">Save & Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
