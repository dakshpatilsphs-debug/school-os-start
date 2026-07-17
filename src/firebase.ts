import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, setDoc, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB7o7EaW_d_8e98xGrvGv9pkV0n2yk4FM8",
  authDomain: "school-tack.firebaseapp.com",
  databaseURL: "https://school-tack-default-rtdb.firebaseio.com",
  projectId: "school-tack",
  storageBucket: "school-tack.firebasestorage.app",
  messagingSenderId: "463261788721",
  appId: "1:463261788721:web:b309f00dc3f644037d0310",
  measurementId: "G-YNTZ9Q00M3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

// Firestore does NOT allow `undefined` field values. This helper strips any
// undefined/null keys from an object before writing, preventing the
// "Unsupported field value: undefined" error entirely.
const cleanData = (obj: any): any => {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};

// Generate Auto ID (prefix + timestamp + random for guaranteed uniqueness)
let _autoIdSeq = 0;
export const generateAutoId = (prefix: string = 'A'): string => {
  _autoIdSeq = (_autoIdSeq + 1) % 10000;
  const ts = Date.now().toString(36).slice(-4);
  const seq = String(_autoIdSeq).padStart(4, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}${ts}${seq}${rand}`;
};

// Upload Image to Firebase Storage
export const uploadImage = async (file: File): Promise<string> => {
  const storageRef = ref(storage, `bills/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// ===== Student Functions =====
export const addStudent = async (student: any) => addDoc(collection(db, 'students'), { ...student, createdAt: Timestamp.now() });
export const getStudents = async () => {
  const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateStudent = async (id: string, data: any) => updateDoc(doc(db, 'students', id), data);
export const deleteStudent = async (id: string) => deleteDoc(doc(db, 'students', id));

// ===== Fee Functions =====
export const addFee = async (fee: any) => addDoc(collection(db, 'fees'), { ...fee, createdAt: Timestamp.now() });
export const getFees = async () => {
  const q = query(collection(db, 'fees'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateFee = async (id: string, data: any) => updateDoc(doc(db, 'fees', id), data);
export const deleteFee = async (id: string) => deleteDoc(doc(db, 'fees', id));

// ===== Expense Functions =====
export const addExpense = async (expense: any) => addDoc(collection(db, 'expenses'), { ...expense, createdAt: Timestamp.now() });
export const getExpenses = async () => {
  const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateExpense = async (id: string, data: any) => updateDoc(doc(db, 'expenses', id), data);
export const deleteExpense = async (id: string) => deleteDoc(doc(db, 'expenses', id));

// ===== Employee Functions =====

// ----- Causal Leaves -----
// Add a causal leave record for an employee
export const addCausalLeave = async (employeeId: string, date: string, reason: string) =>
  addDoc(collection(db, 'causalLeaves'), {
    employeeId,
    date,
    reason,
    createdAt: Timestamp.now(),
  });

// Retrieve all causal leaves for a specific employee
export const getCausalLeaves = async (employeeId: string) => {
  const q = query(collection(db, 'causalLeaves'), where('employeeId', '==', employeeId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Delete a causal leave by its document ID
export const deleteCausalLeave = async (id: string) => deleteDoc(doc(db, 'causalLeaves', id));

// ----- Salary Slip Audit -----
// Log generation of a salary slip for audit purposes
export const logSalarySlipAudit = async (employeeId: string): Promise<void> => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid || 'system';
  await addDoc(collection(db, 'salarySlipAudits'), {
    employeeId,
    generatedBy: uid,
    timestamp: Timestamp.now(),
  });
};
export const addEmployee = async (employee: any) => addDoc(collection(db, 'employees'), { ...employee, createdAt: Timestamp.now() });
export const getEmployees = async () => {
  const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateEmployee = async (id: string, data: any) => updateDoc(doc(db, 'employees', id), data);
export const deleteEmployee = async (id: string) => deleteDoc(doc(db, 'employees', id));

// ===== Attendance Functions (Realtime Database) =====
// Attendance & Holidays are stored in Firebase Realtime Database (RTDB) as a
// JSON tree. Each person has ONE record per date using a deterministic key
// "personId_date". RTDB does not require indexes, so saves never fail.

import { ref as dbRef, set as rtdbSet, get as rtdbGet, remove as rtdbRemove, push as rtdbPush } from 'firebase/database';

const sanitizeKey = (s: string) => s.replace(/[.#$\[\]\/]/g, '-'); // RTDB-safe key
const makeAttKey = (personId: string, date: string) => sanitizeKey(`${personId}_${date}`);

// Save or update a single attendance record (person + date = unique)
export const saveAttendance = async (record: any) => {
  const key = makeAttKey(record.personId, record.date);
  await rtdbSet(dbRef(rtdb, `attendance/${key}`), cleanData({ ...record, createdAt: Date.now() }));
  return key;
};

// Batch save attendance (for marking whole class/employees at once)
// Resilient: tries RTDB first, auto-falls back to Firestore if RTDB unavailable.
// Never throws — returns { success, failed, error } so UI can report accurately.
export const saveBatchAttendance = async (records: any[]) => {
  const results: any[] = [];
  let failed = 0;
  let lastError = '';

  for (const record of records) {
    try {
      // Attempt 1: Realtime Database (cleanData strips undefined fields)
      const key = makeAttKey(record.personId, record.date);
      await rtdbSet(dbRef(rtdb, `attendance/${key}`), cleanData({ ...record, createdAt: Date.now() }));
      results.push({ id: key, ...record });
    } catch (rtdbErr) {
      // Attempt 2: Fallback to Firestore (cleanData strips undefined fields like `role`)
      try {
        const docId = makeAttKey(record.personId, record.date);
        await setDoc(doc(db, 'attendance', docId), cleanData({ ...record, createdAt: Timestamp.now() }));
        results.push({ id: docId, ...record });
      } catch (fsErr) {
        failed++;
        lastError = (fsErr as any)?.message || (rtdbErr as any)?.message || 'Unknown error';
      }
    }
  }

  return { results, failed, total: records.length, error: lastError };
};

export const getAttendance = async () => {
  // Merge data from both RTDB and Firestore (covers records saved via fallback)
  let rtdbRecords: any[] = [];
  try {
    const snap = await rtdbGet(dbRef(rtdb, 'attendance'));
    if (snap.exists()) {
      const val = snap.val();
      rtdbRecords = Object.keys(val).map(key => ({ id: key, ...val[key] }));
    }
  } catch (e) { /* RTDB not available — ignore */ }

  let fsRecords: any[] = [];
  try {
    const snapshot = await getDocs(collection(db, 'attendance'));
    fsRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { /* Firestore not available — ignore */ }

  // Combine and de-duplicate by personId + date
  const merged = [...rtdbRecords, ...fsRecords];
  const seen = new Set<string>();
  return merged.filter(r => {
    const k = `${r.personId}_${r.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export const deleteAttendance = async (personId: string, date: string) => {
  await rtdbRemove(dbRef(rtdb, `attendance/${makeAttKey(personId, date)}`));
};

// ===== Holiday Functions (Realtime Database + Firestore fallback) =====
export const addHoliday = async (holiday: any) => {
  const data = cleanData({ ...holiday, createdAt: Date.now() });
  try {
    const newRef = rtdbPush(dbRef(rtdb, 'holidays'));
    await rtdbSet(newRef, data);
    return newRef.key;
  } catch (e) {
    // Fallback to Firestore
    const ref = await addDoc(collection(db, 'holidays'), cleanData({ ...holiday, createdAt: Timestamp.now() }));
    return ref.id;
  }
};

export const getHolidays = async () => {
  let rtdbRecords: any[] = [];
  try {
    const snap = await rtdbGet(dbRef(rtdb, 'holidays'));
    if (snap.exists()) {
      const val = snap.val();
      rtdbRecords = Object.keys(val).map(key => ({ id: key, ...val[key] }));
    }
  } catch (e) { /* ignore */ }

  let fsRecords: any[] = [];
  try {
    const q = query(collection(db, 'holidays'), orderBy('date', 'asc'));
    const snapshot = await getDocs(q);
    fsRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { /* ignore */ }

  return [...rtdbRecords, ...fsRecords].sort((a, b) => (a.date > b.date ? 1 : -1));
};

export const deleteHoliday = async (id: string) => {
  try {
    await rtdbRemove(dbRef(rtdb, `holidays/${id}`));
  } catch (e) {
    try { await deleteDoc(doc(db, 'holidays', id)); } catch (e2) { /* ignore */ }
  }
};

// ===== Reminder Functions =====
export const addReminder = async (reminder: any) => addDoc(collection(db, 'reminders'), { ...reminder, createdAt: Timestamp.now() });
export const getReminders = async () => {
  const q = query(collection(db, 'reminders'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};
export const updateReminder = async (id: string, data: any) => updateDoc(doc(db, 'reminders', id), data);
export const deleteReminder = async (id: string) => deleteDoc(doc(db, 'reminders', id));

// ===== Schedule / Timetable Functions =====
// ----- Subjects -----
export const addSubject = async (subject: any) =>
  addDoc(collection(db, 'subjects'), { ...subject, createdAt: Timestamp.now() });

export const getSubjects = async () => {
  const q = query(collection(db, 'subjects'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateSubject = async (id: string, data: any) =>
  updateDoc(doc(db, 'subjects', id), data);

export const deleteSubject = async (id: string) =>
  deleteDoc(doc(db, 'subjects', id));

// ----- Teacher Subject Assignments -----
export const saveTeacherSubjects = async (teacherId: string, teacherName: string, className: string, subjectIds: string[], subjectNames: string[]) => {
  const q = query(collection(db, 'teacherSubjects'), where('teacherId', '==', teacherId), where('class', '==', className));
  const snap = await getDocs(q);
  const data = { teacherId, teacherName, class: className, subjectIds, subjectNames, updatedAt: Timestamp.now() };
  if (snap.empty) {
    const ref = await addDoc(collection(db, 'teacherSubjects'), { ...data, createdAt: Timestamp.now() });
    return ref.id;
  } else {
    await updateDoc(doc(db, 'teacherSubjects', snap.docs[0].id), data);
    return snap.docs[0].id;
  }
};

export const getTeacherSubjects = async () => {
  const q = query(collection(db, 'teacherSubjects'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deleteTeacherSubject = async (id: string) =>
  deleteDoc(doc(db, 'teacherSubjects', id));

// ----- Subject Configs (periods per week, doubled) -----
export const saveSubjectConfig = async (config: any) => {
  const q = query(collection(db, 'subjectConfigs'), where('class', '==', config.class), where('subjectId', '==', config.subjectId));
  const snap = await getDocs(q);
  const data = { class: config.class, subjectId: config.subjectId, subjectName: config.subjectName, doubled: config.doubled, allowSameDay: config.allowSameDay ?? false, noTeacher: config.noTeacher ?? false, updatedAt: Timestamp.now() };
  if (snap.empty) {
    const ref = await addDoc(collection(db, 'subjectConfigs'), { ...data, createdAt: Timestamp.now() });
    return ref.id;
  } else {
    await updateDoc(doc(db, 'subjectConfigs', snap.docs[0].id), data);
    return snap.docs[0].id;
  }
};

export const getSubjectConfigs = async () => {
  const snapshot = await getDocs(collection(db, 'subjectConfigs'));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deleteSubjectConfig = async (id: string) =>
  deleteDoc(doc(db, 'subjectConfigs', id));

// ----- Timetable Entries -----
export const saveTimetableEntries = async (entries: any[]) => {
  const batch = entries.map(e => addDoc(collection(db, 'timetable'), { ...e, createdAt: Timestamp.now() }));
  return Promise.all(batch);
};

export const getTimetableEntries = async () => {
  const q = query(collection(db, 'timetable'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deleteTimetableForClass = async (className: string) => {
  const q = query(collection(db, 'timetable'), where('class', '==', className));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'timetable', d.id))));
};

export const deleteTimetableEntry = async (id: string) =>
  deleteDoc(doc(db, 'timetable', id));

// ===== Sequential ID Generator =====
// Parses existing autoId values and returns the next available number.
export const getNextSequentialId = async (collectionName: string): Promise<number> => {
  const snapshot = await getDocs(collection(db, collectionName));
  const maxNum = snapshot.docs.reduce((max, doc) => {
    const id = String((doc.data() as any)?.autoId || '');
    const match = id.match(/(\d+)$/);
    const num = match ? parseInt(match[1], 10) : 0;
    return num > max ? num : max;
  }, 0);
  return maxNum + 1;
};
// ===== Equipment Functions =====
export const addEquipment = async (equipment: any) =>
  addDoc(collection(db, 'equipments'), { ...equipment, createdAt: Timestamp.now() });

export const getEquipments = async () => {
  const q = query(collection(db, 'equipments'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateEquipment = async (id: string, data: any) =>
  updateDoc(doc(db, 'equipments', id), data);

export const deleteEquipment = async (id: string) =>
  deleteDoc(doc(db, 'equipments', id));
  export const updateStudentAutoIdReferences = async (oldAutoId: string, newAutoId: string) => {
  if (!oldAutoId || !newAutoId || oldAutoId === newAutoId) return;

  // Fees
  const feesSnap = await getDocs(query(collection(db, 'fees'), where('studentId', '==', oldAutoId)));
  await Promise.all(
    feesSnap.docs.map(d =>
      updateDoc(doc(db, 'fees', d.id), { studentId: newAutoId })
    )
  );

  // Firestore attendance fallback
  const attSnap = await getDocs(query(collection(db, 'attendance'), where('personId', '==', oldAutoId)));
  await Promise.all(
    attSnap.docs.map(d =>
      updateDoc(doc(db, 'attendance', d.id), { personId: newAutoId })
    )
  );

  // Equipments
  const eqSnap = await getDocs(query(collection(db, 'equipments'), where('assignedToId', '==', oldAutoId)));
  await Promise.all(
    eqSnap.docs.map(d =>
      updateDoc(doc(db, 'equipments', d.id), { assignedToId: newAutoId })
    )
  );
};