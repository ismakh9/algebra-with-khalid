'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCheck, LogIn, RefreshCw, Users } from 'lucide-react';
import { AccountMenu, SchoolBrand } from '@/components/school-auth';
import { DocumentLink } from '@/components/document-link';
import { getBackend } from '@/lib/backend';
import { QUESTION_TOPICS, type TeacherDashboard } from '@/lib/school';
import { CHALLENGE_TOPICS } from '@/lib/challenges';

const kinds: Record<string, string> = { solve: 'Solver', practice: 'Practice', challenge_view: 'Challenge opened', challenge_answer: 'Challenge answer' };
const topics = [...new Set([...QUESTION_TOPICS, ...CHALLENGE_TOPICS])].sort();
function when(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Mogadishu' }).format(new Date(value)) : 'Not yet';
}
export default function Dashboard() {
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [days, setDays] = useState('30');
  const [student, setStudent] = useState('');
  const [kind, setKind] = useState('');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function fetchReport() {
      setLoading(true); setError('');
      try {
        const backend = getBackend();
        if (!backend) throw new Error('Backend unavailable');
        const response = await backend.rpc('teacher_dashboard', { p_days: Number(days), p_student: student || null, p_kind: kind || null, p_topic: topic || null, p_page: page });
        if (response.error || !response.data) throw response.error ?? new Error('Report unavailable');
        if (active) setData(response.data as TeacherDashboard);
      } catch { if (active) setError('Could not load the class dashboard. Check your connection and try refreshing.'); }
      finally { if (active) setLoading(false); }
    }
    void fetchReport();
    return () => { active = false; };
  }, [days, student, kind, topic, page, revision]);
  const accuracy = data?.summary.attempts ? `${Math.round(data.summary.correct / data.summary.attempts * 100)}%` : '—';
  return <div className="school-dashboard site-shell">
    <header className="site-header"><SchoolBrand /><DocumentLink className="text-button" href="/"><ArrowLeft size={16} />Back to solver</DocumentLink></header>
    <AccountMenu />
    <main className="dashboard-main">
      <div className="dashboard-heading"><div><span className="eyebrow">YOUR CLASSROOM, AT A GLANCE</span><h1>See the learning unfold.</h1><p>School sign-ins, question topics, and students’ progress.</p></div><button className="dashboard-refresh" disabled={loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      <div className="dashboard-filters">
        <label>Time period<select value={days} onChange={e => { setDays(e.target.value); setPage(0); }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
        <label>Student<select value={student} onChange={e => { setStudent(e.target.value); setPage(0); }}><option value="">All students</option>{data?.students.map(s => <option key={s.id} value={s.id}>{s.email}</option>)}</select></label>
        <label>Activity<select value={kind} onChange={e => { setKind(e.target.value); setPage(0); }}><option value="">All activities</option>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Question type<select value={topic} onChange={e => { setTopic(e.target.value); setPage(0); }}><option value="">All question types</option>{topics.map(t => <option key={t}>{t}</option>)}</select></label>
      </div>
      {error && <p className="school-error" role="alert">{error}</p>}
      {loading && <output className="dashboard-status">Loading the latest activity…</output>}
      {data && <div aria-busy={loading} className={loading ? 'dashboard-refreshing' : ''}>
        <div className="dashboard-stats">{[
          { label: 'Student accounts', value: data.summary.students, icon: Users, note: 'All registered students' },
          { label: 'School sign-ins', value: data.summary.logins, icon: LogIn, note: 'Verified sessions in this period' },
          { label: 'Questions explored', value: data.summary.questions, icon: BookOpen, note: 'Matching your filters' },
          { label: 'Answer accuracy', value: accuracy, icon: CheckCheck, note: `${data.summary.correct} correct of ${data.summary.attempts} attempts` },
        ].map(s => <section key={s.label}><s.icon size={19} /><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></section>)}</div>
        <div className="dashboard-panels"><section className="dashboard-panel"><h2>What students are working on</h2><p>Solver submissions, practice attempts, and generated challenges.</p>{data.topics.length ? <ul className="dashboard-topics">{data.topics.map(t => <li key={t.topic}><div><span>{t.topic}</span><b>{t.count}</b></div><div className="topic-bar"><i style={{ width: `${Math.max(3, t.count / Math.max(...data.topics.map(x => x.count)) * 100)}%` }} /></div></li>)}</ul> : <p className="dashboard-empty">Question types will appear after students start learning.</p>}</section>
          <section className="dashboard-panel"><h2>Recent sign-ins</h2><p>Successful email verifications. Times are East Africa Time.</p>{data.logins.length ? <ul className="dashboard-logins">{data.logins.map((l, i) => <li key={`${l.email}-${l.created_at}-${i}`}><span className="student-avatar">{l.email[0].toUpperCase()}</span><div><strong>{l.email}</strong><small>{when(l.created_at)}</small></div></li>)}</ul> : <p className="dashboard-empty">Student sign-ins will appear here.</p>}</section></div>
        <section className="dashboard-panel"><h2>Your students</h2><p>Click a student to filter their question history. Counts use the selected time period.</p><div className="dashboard-table-wrap"><table><thead><tr><th>Student</th><th>Last sign-in</th><th>Sign-ins</th><th>Questions</th><th>Correct / attempts</th><th>Level</th></tr></thead><tbody>{data.students.map(s => <tr key={s.id}><td><button className="student-link" onClick={() => { setStudent(s.id); setPage(0); }}>{s.email}</button></td><td>{when(s.last_login)}</td><td>{s.logins}</td><td>{s.questions}</td><td>{s.correct} / {s.attempts}</td><td><span className="dashboard-level">{s.level}</span></td></tr>)}</tbody></table></div>{!data.students.length && <p className="dashboard-empty">No students have signed in yet. Share the website with your class to get started.</p>}</section>
        <section className="dashboard-panel"><div className="dashboard-table-heading"><div><h2>Question history</h2><p>The equations students submit and the answers they try.</p></div><span>{data.total} activities</span></div><div className="dashboard-table-wrap"><table><thead><tr><th>Student / time</th><th>Activity</th><th>Question</th><th>Type</th><th>Answer / result</th></tr></thead><tbody>{data.activities.map(a => <tr key={a.id}><td>{a.email}<small>{when(a.created_at)}</small></td><td>{kinds[a.kind]}{a.level && <small>Level {a.level}</small>}</td><td className="dashboard-equation">{a.equation}</td><td>{a.topic}</td><td>{a.answer && <span className="dashboard-equation">{a.answer}</span>}<small className={a.correct === true ? 'result-correct' : ''}>{a.correct === null ? ({ unique: 'Solved', none: 'No solution', infinite: 'All real numbers', unsupported: 'Unsupported input', viewed: 'Opened' }[a.result] || a.result) : a.correct ? 'Correct' : 'Try again'}</small></td></tr>)}</tbody></table></div>{!data.activities.length && <p className="dashboard-empty">No activity matches these filters.</p>}<div className="dashboard-pagination"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}><ArrowLeft size={15} />Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(data.total / 50))}</span><button disabled={(page + 1) * 50 >= data.total || loading} onClick={() => setPage(p => p + 1)}>Next<ArrowRight size={15} /></button></div></section>
      </div>}
    </main><footer><span>Algebra with Khalid · Abaarso School</span><span>Only your teacher account can access this dashboard.</span></footer>
  </div>;
}
