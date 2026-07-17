import React, { useState, useEffect, useCallback } from 'react';
import { FiBookOpen, FiUsers, FiCalendar, FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiRefreshCw, FiEye, FiGrid, FiClock, FiAlertTriangle, FiPrinter, FiDownload, FiSliders } from 'react-icons/fi';
import type { Subject, TeacherSubject, TimetableEntry, PeriodSlot, Employee, Student, SubjectConfig } from './types';
import { WEEKDAYS, DEFAULT_PERIODS } from './types';
import jsPDF from 'jspdf';

interface ScheduleSectionProps {
  employees: Employee[];
  students: Student[];
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
  employees, students, showNotification,
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
  const [viewMode, setViewMode] = useState<'grid' | 'teacher'>('grid');
  const [selectedClass, setSelectedClass] = useState('');
  const [numPeriods, setNumPeriods] = useState(6);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>(DEFAULT_PERIODS.slice(0, 6));
  const [selectedCell, setSelectedCell] = useState<{ day: string; period: number } | null>(null);
  const [cellSubjectId, setCellSubjectId] = useState('');
  const [cellTeacherId, setCellTeacherId] = useState('');
  const [selectedTeacherView, setSelectedTeacherView] = useState('');

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

  const updateSubjectConfig = (subjectId: string, subjectName: string, field: 'periodsPerWeek' | 'doubled', value: number | boolean) => {
    setSubjectConfigs(prev => {
      const existing = prev.findIndex(c => c.class === configClass && c.subjectId === subjectId);
      const updated = [...prev];
      if (existing >= 0) {
        updated[existing] = { ...updated[existing], [field]: value };
      } else {
        updated.push({ class: configClass, subjectId, subjectName, periodsPerWeek: 1, doubled: false, [field]: value });
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
        await saveSubjectConfig({ class: cfg.class, subjectId: cfg.subjectId, subjectName: cfg.subjectName, periodsPerWeek: cfg.periodsPerWeek, doubled: cfg.doubled });
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
      // Collect unique subject-teacher pairs (deduplicated by subjectId)
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

      const totalSlots = WEEKDAYS.length * numPeriods;

      // Step 1: Determine periods per subject — configured subjects get exact count, others get even share of remaining
      const periodsPerSubject = new Map<string, number>();
      const doubledSet = new Set<string>();
      let configuredUsed = 0;

      for (const pair of pairs) {
        const cfg = subjectConfigs.find(c => c.class === selectedClass && c.subjectId === pair.subjectId);
        if (cfg && cfg.periodsPerWeek > 0) {
          const n = cfg.doubled ? Math.floor(cfg.periodsPerWeek / 2) * 2 : cfg.periodsPerWeek;
          periodsPerSubject.set(pair.subjectId, n);
          if (cfg.doubled && n >= 2) doubledSet.add(pair.subjectId);
          configuredUsed += n;
        }
      }

      const remainingSlots = totalSlots - configuredUsed;
      if (remainingSlots < 0) {
        showNotification(`Not enough slots (need ${configuredUsed}, have ${totalSlots}). Reduce periods per week.`, 'error');
        setLoading(false); return;
      }

      // Distribute remaining slots among unconfigured subjects
      const unconfigured = pairs.filter(p => !periodsPerSubject.has(p.subjectId));
      if (unconfigured.length > 0) {
        const perSubject = Math.floor(remainingSlots / unconfigured.length);
        const extra = remainingSlots % unconfigured.length;
        for (let i = 0; i < unconfigured.length; i++) {
          periodsPerSubject.set(unconfigured[i].subjectId, perSubject + (i < extra ? 1 : 0));
        }
      } else if (remainingSlots > 0) {
        // All subjects configured, distribute remaining among all
        for (const pair of pairs) {
          const cur = periodsPerSubject.get(pair.subjectId) || 0;
          periodsPerSubject.set(pair.subjectId, cur + Math.floor(remainingSlots / pairs.length));
        }
        let leftover = remainingSlots % pairs.length;
        for (let i = 0; i < leftover && i < pairs.length; i++) {
          const cur = periodsPerSubject.get(pairs[i].subjectId) || 0;
          periodsPerSubject.set(pairs[i].subjectId, cur + 1);
        }
      }

      type AllocItem = { subjectId: string; subjectName: string; teacherId: string; teacherName: string; span: number };
      const allocation: AllocItem[] = [];

      // Step 2: Build allocation list from periodsPerSubject
      for (const pair of pairs) {
        const count = periodsPerSubject.get(pair.subjectId) || 0;
        const doubled = doubledSet.has(pair.subjectId);
        let remaining = count;
        while (remaining > 0) {
          if (doubled && remaining >= 2) {
            allocation.push({ ...pair, span: 2 });
            remaining -= 2;
          } else {
            allocation.push({ ...pair, span: 1 });
            remaining -= 1;
          }
        }
      }

      // Step 3: Shuffle and sort so doubles come first
      for (let i = allocation.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allocation[i], allocation[j]] = [allocation[j], allocation[i]];
      }
      allocation.sort((a, b) => b.span - a.span);

      // Step 4: Place into grid with day-level constraints
      const usedTeacherSlots = new Set<string>();
      const filledSlots = new Set<string>();
      const entries: any[] = [];
      const remainingAlloc = [...allocation];
      const subjectDayCount = new Map<string, number>(); // key: `${subjectId}_${day}`
      const doubledDays = new Set<string>();            // days that already have a doubled pair

      const placeItem = (item: AllocItem, day: string, p: number) => {
        const slotKey = `${day}_${p}`;
        const teacherKey = `${item.teacherId}_${day}_${p}`;
        if (item.span === 2 && p + 1 <= numPeriods) {
          const nextKey = `${day}_${p + 1}`;
          if (filledSlots.has(nextKey)) return false;
          const nextTeacherKey = `${item.teacherId}_${day}_${p + 1}`;
          const slot = periodSlots[p - 1];
          const nextSlot = periodSlots[p];
          entries.push({ class: selectedClass, day, period: p, subjectId: item.subjectId, subjectName: item.subjectName, teacherId: item.teacherId, teacherName: item.teacherName, startTime: slot.startTime, endTime: slot.endTime });
          entries.push({ class: selectedClass, day, period: p + 1, subjectId: item.subjectId, subjectName: item.subjectName, teacherId: item.teacherId, teacherName: item.teacherName, startTime: nextSlot.startTime, endTime: nextSlot.endTime });
          usedTeacherSlots.add(teacherKey);
          usedTeacherSlots.add(nextTeacherKey);
          filledSlots.add(slotKey);
          filledSlots.add(nextKey);
          doubledDays.add(day);
          return true;
        }
        if (item.span === 1) {
          const slot = periodSlots[p - 1];
          entries.push({ class: selectedClass, day, period: p, subjectId: item.subjectId, subjectName: item.subjectName, teacherId: item.teacherId, teacherName: item.teacherName, startTime: slot.startTime, endTime: slot.endTime });
          usedTeacherSlots.add(teacherKey);
          filledSlots.add(slotKey);
          return true;
        }
        return false;
      };

      for (const day of WEEKDAYS) {
        for (let p = 1; p <= numPeriods; p++) {
          const slotKey = `${day}_${p}`;
          if (filledSlots.has(slotKey)) continue;

          let placed = false;

          // Tier 1: no teacher conflict + respects all day constraints
          for (let ai = 0; ai < remainingAlloc.length && !placed; ai++) {
            const item = remainingAlloc[ai];
            const dayKey = `${item.subjectId}_${day}`;
            if ((subjectDayCount.get(dayKey) || 0) >= (item.span === 2 ? 1 : 2)) continue;
            if (item.span === 2 && doubledDays.has(day)) continue;

            const teacherKey = `${item.teacherId}_${day}_${p}`;
            if (usedTeacherSlots.has(teacherKey)) continue;

            if (item.span === 2 && p + 1 <= numPeriods) {
              const nextKey = `${day}_${p + 1}`;
              const nextTeacherKey = `${item.teacherId}_${day}_${p + 1}`;
              if (!filledSlots.has(nextKey) && !usedTeacherSlots.has(nextTeacherKey)) {
                if (placeItem(item, day, p)) {
                  subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                  remainingAlloc.splice(ai, 1);
                  placed = true;
                }
              }
            } else if (item.span === 1) {
              if (placeItem(item, day, p)) {
                subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                remainingAlloc.splice(ai, 1);
                placed = true;
              }
            }
          }

          // Tier 2: allow teacher conflict, still respect day constraints
          if (!placed) {
            for (let ai = 0; ai < remainingAlloc.length && !placed; ai++) {
              const item = remainingAlloc[ai];
              const dayKey = `${item.subjectId}_${day}`;
              if ((subjectDayCount.get(dayKey) || 0) >= (item.span === 2 ? 1 : 2)) continue;
              if (item.span === 2 && doubledDays.has(day)) continue;

              if (item.span === 2 && p + 1 <= numPeriods) {
                if (!filledSlots.has(`${day}_${p + 1}`) && placeItem(item, day, p)) {
                  subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                  remainingAlloc.splice(ai, 1);
                  placed = true;
                }
              } else if (item.span === 1) {
                if (placeItem(item, day, p)) {
                  subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                  remainingAlloc.splice(ai, 1);
                  placed = true;
                }
              }
            }
          }

          // Tier 3: force place — skip all constraints
          if (!placed && remainingAlloc.length > 0) {
            const item = remainingAlloc[0];
            const dayKey = `${item.subjectId}_${day}`;
            if (item.span === 2 && p + 1 <= numPeriods) {
              if (!filledSlots.has(`${day}_${p + 1}`) && placeItem(item, day, p)) {
                subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                remainingAlloc.splice(0, 1);
                placed = true;
              }
            } else if (item.span === 1) {
              if (placeItem(item, day, p)) {
                subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                remainingAlloc.splice(0, 1);
                placed = true;
              }
            }
            // If span=2 can't fit at this period (last period or next slot filled),
            // try placing a span=1 item instead
            if (!placed) {
              const s1idx = remainingAlloc.findIndex(a => a.span === 1);
              if (s1idx >= 0) {
                const s1 = remainingAlloc[s1idx];
                const s1Key = `${s1.subjectId}_${day}`;
                if (placeItem(s1, day, p)) {
                  subjectDayCount.set(s1Key, (subjectDayCount.get(s1Key) || 0) + 1);
                  remainingAlloc.splice(s1idx, 1);
                  placed = true;
                }
              }
            }
          }
        }
      }

      // Post-process: fill any remaining empty slots with leftover items
      if (remainingAlloc.length > 0) {
        for (const day of WEEKDAYS) {
          for (let p = 1; p <= numPeriods; p++) {
            if (remainingAlloc.length === 0) break;
            const slotKey = `${day}_${p}`;
            if (filledSlots.has(slotKey)) continue;

            const item = remainingAlloc[0];
            const dayKey = `${item.subjectId}_${day}`;
            if (item.span === 2 && p + 1 <= numPeriods && !filledSlots.has(`${day}_${p + 1}`)) {
              if (placeItem(item, day, p)) {
                subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                remainingAlloc.splice(0, 1);
              }
            } else if (item.span === 1) {
              if (placeItem(item, day, p)) {
                subjectDayCount.set(dayKey, (subjectDayCount.get(dayKey) || 0) + 1);
                remainingAlloc.splice(0, 1);
              }
            } else {
              // span=2 can't fit here, try a span=1 item
              const s1idx = remainingAlloc.findIndex(a => a.span === 1);
              if (s1idx >= 0) {
                const s1 = remainingAlloc[s1idx];
                const s1Key = `${s1.subjectId}_${day}`;
                if (placeItem(s1, day, p)) {
                  subjectDayCount.set(s1Key, (subjectDayCount.get(s1Key) || 0) + 1);
                  remainingAlloc.splice(s1idx, 1);
                }
              }
            }
          }
        }
      }

      await deleteTimetableForClass(selectedClass);
      await saveTimetableEntries(entries);
      await loadTimetable();
      showNotification('Timetable generated with subject settings', 'success');
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
      const pw = 210, ML = 12, MR = pw - 12, CW = MR - ML;
      const daysColW = CW / 6;
      const timeColW = daysColW;
      const dataColW = (CW - timeColW) / 5;

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(2, 132, 199);
      doc.text(`Timetable - ${selectedClass}`, pw / 2, 18, { align: 'center' });

      // Subtitle (date)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Generated: ${today}`, pw / 2, 25, { align: 'center' });

      // Draw header row
      const startY = 32;
      const rowH = 10;
      const headerBg: [number, number, number] = [241, 245, 249];
      const borderColor: [number, number, number] = [203, 213, 225];
      const textColor: [number, number, number] = [30, 41, 59];
      const secColor: [number, number, number] = [100, 116, 139];

      // Header cells
      let x = ML;
      doc.setFillColor(...headerBg);
      doc.setDrawColor(...borderColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...secColor);

      doc.rect(x, startY, timeColW, rowH, 'FD');
      doc.text('Period', x + timeColW / 2, startY + 6.5, { align: 'center' });
      x += timeColW;

      for (const day of WEEKDAYS) {
        doc.rect(x, startY, dataColW, rowH, 'FD');
        doc.text(day.substring(0, 3), x + dataColW / 2, startY + 6.5, { align: 'center' });
        x += dataColW;
      }

      // Data rows
      let y = startY + rowH;
      const dataRowH = 14;

      for (let p = 1; p <= numPeriods; p++) {
        const slot = periodSlots[p - 1];
        x = ML;

        // Period column
        doc.setDrawColor(...borderColor);
        doc.setFillColor(248, 250, 252);
        doc.rect(x, y, timeColW, dataRowH, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...secColor);
        doc.text(`P${p}`, x + timeColW / 2, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(slot ? `${slot.startTime}-${slot.endTime}` : '', x + timeColW / 2, y + dataRowH - 3, { align: 'center' });
        x += timeColW;

        // Day columns
        for (const day of WEEKDAYS) {
          const entry = timetable.find(e => e.class === selectedClass && e.day === day && e.period === p);
          const isOdd = (p % 2) === 1;
          doc.setDrawColor(...borderColor);
          doc.setFillColor(isOdd ? 255 : 252, isOdd ? 255 : 252, isOdd ? 255 : 252);
          doc.rect(x, y, dataColW, dataRowH, 'FD');

          if (entry && entry.subjectId) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...textColor);
            const subjText = entry.subjectName.length > 14 ? entry.subjectName.substring(0, 13) + '.' : entry.subjectName;
            doc.text(subjText, x + dataColW / 2, y + 5.5, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...secColor);
            const tName = entry.teacherName.length > 16 ? entry.teacherName.substring(0, 15) + '.' : entry.teacherName;
            doc.text(tName, x + dataColW / 2, y + dataRowH - 3, { align: 'center' });
          }

          x += dataColW;
        }

        y += dataRowH;
      }

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is a computer-generated timetable.', pw / 2, y + 10, { align: 'center' });

      doc.save(`Timetable_${selectedClass.replace(/\s+/g, '_')}.pdf`);
      showNotification('Timetable PDF downloaded', 'success');
    } catch { showNotification('Failed to generate PDF', 'error'); }
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
                  const assignedSubjects = subjects.filter(s => s.id && classSubjectIds.has(s.id));

                  if (assignedSubjects.length === 0) {
                    return <div className="text-center py-12 text-gray-500"><p>No subjects assigned to this class yet. Go to "Assign to Teachers" first.</p></div>;
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-800/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Subject</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Periods / Week</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Double Period</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedSubjects.map(s => {
                            const cfg = getConfigForSubject(s.id!);
                            return (
                              <tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                                <td className="px-4 py-3 font-semibold text-sm">{classSubjectMap[s.id!]}</td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={cfg?.periodsPerWeek ?? 1}
                                    onChange={e => updateSubjectConfig(s.id!, classSubjectMap[s.id!], 'periodsPerWeek', Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-20 p-2 bg-gray-800 rounded-lg border border-gray-700 text-white text-sm text-center"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={cfg?.doubled ?? false}
                                      onChange={e => updateSubjectConfig(s.id!, classSubjectMap[s.id!], 'doubled', e.target.checked)}
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
                        Tip: "Periods / Week" controls how many times this subject appears in the timetable.
                        "Double Period" means two consecutive periods for the same subject.
                        These settings are used when auto-generating the timetable.
                      </p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                  <div className="md:col-span-2 flex items-end gap-2">
                    <button onClick={handleAutoGenerate} disabled={loading} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg shadow-purple-500/20 disabled:opacity-50">
                      <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Generating...' : 'Auto Generate'}
                    </button>
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
                  </div>
                </div>

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
                            <tr key={p}>
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
    </div>
  );
};
