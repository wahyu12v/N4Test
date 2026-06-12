import { useState, useEffect, useRef } from 'react';

export default function App() {
  // 1. STATE MANAGEMENT
  const [view, setView] = useState('home'); // 'home' atau 'test'
  const [questionSets, setQuestionSets] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [allQuestionsData, setAllQuestionsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showFurigana, setShowFurigana] = useState(localStorage.getItem('n4_show_furigana') === 'true');

  // Derived state: data soal diturunkan langsung dari allQuestionsData berdasarkan activeSet.id
  const questions = (activeSet && allQuestionsData[activeSet.id]) || [];

  // 2. EFFECT: MEMUAT CONFIG & SELURUH DATABASE SOAL SEKALIGUS (PRE-FETCH)
  useEffect(() => {
    fetch(`/config.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(configData => {
        setQuestionSets(configData);
        if (configData.length > 0) {
          // Pre-fetch seluruh file soal secara paralel
          const fetchPromises = configData.map(set => 
            fetch(`/${set.file}?t=${Date.now()}`)
              .then(res => res.json())
              .then(data => ({ id: set.id, data }))
              .catch(err => {
                console.error(`Gagal memuat ${set.file}:`, err);
                return { id: set.id, data: null };
              })
          );
          
          Promise.all(fetchPromises).then(results => {
            const cache = {};
            results.forEach(item => {
              if (item.data) {
                cache[item.id] = item.data;
              }
            });
            setAllQuestionsData(cache);
            
            // Set default active set ke set pertama
            const defaultSet = configData[0];
            setActiveSet(defaultSet);
            
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Gagal memuat config.json:", err);
        setLoading(false);
      });
  }, []);

  // 3. SINKRONISASI STATUS DAN SKOR UNTUK DASHBOARD BERANDA
  const getSetStatus = (setId) => {
    const savedSubmitted = localStorage.getItem(`n4_submitted_${setId}`);
    if (savedSubmitted === 'true') {
      const savedScore = localStorage.getItem(`n4_score_${setId}`);
      return { type: 'completed', text: savedScore ? `Selesai (Skor: ${savedScore})` : 'Selesai' };
    }
    
    const savedAnswers = localStorage.getItem(`n4_answers_${setId}`);
    if (savedAnswers) {
      try {
        const ans = JSON.parse(savedAnswers);
        const count = Object.keys(ans).length;
        if (count > 0) {
          return { type: 'in-progress', text: `Sedang dikerjakan (${count} / 56 Soal)` };
        }
      } catch {
        // Abaikan error parsing
      }
    }
    
    return { type: 'not-started', text: 'Belum dicoba' };
  };

  // 4. FUNGSIONALITAS INTERAKSI
  const startTest = (set) => {
    setActiveSet(set);
    setView('test');
    setLoading(false);
  };

  const cardThemes = [
    { class: 'theme-indigo', icon: '📖' },
    { class: 'theme-teal', icon: '⚡' },
    { class: 'theme-violet', icon: '🎯' },
    { class: 'theme-rose', icon: '🔥' }
  ];

  // 5. RENDERING
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ border: '3px solid var(--border-color)', borderTop: '3px solid var(--accent)', borderRadius: '50%', width: '36px', height: '36px', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', fontWeight: '500', color: 'var(--text-muted)' }}>問題を読み込んでいます...</p>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
      </div>
    );
  }

  // A. RENDERING DASHBOARD (HALAMAN UTAMA)
  if (view === 'home') {
    return (
      <>
        <header className="site-header home-header">
          <div className="logo-area">
            <span className="logo-icon">⛩️</span>
            <h1>JLPT N4 Portal Latihan</h1>
          </div>
          <span className="badge">N4 Portal</span>
        </header>

        <div className="dashboard-container">
          <div className="hero-section">
            <h2>Persiapkan Ujian JLPT N4 Anda</h2>
            <p>Pilih paket simulasi soal latihan di bawah ini untuk menguji kemampuan bahasa Jepang Anda. Ujian dilengkapi dengan batas waktu, pelacakan otomatis, dan penyimpanan kemajuan instan.</p>
          </div>

          <div className="sets-grid">
            {questionSets.map((set, idx) => {
              const status = getSetStatus(set.id);
              const theme = cardThemes[idx % cardThemes.length] || { class: 'theme-indigo', icon: '📖' };
              
              // Teks tombol dinamis
              let btnText = "Mulai Latihan →";
              if (status.type === 'completed') {
                btnText = "Tinjau Hasil / Ulangi →";
              } else if (status.type === 'in-progress') {
                btnText = "Lanjutkan Latihan →";
              }

              return (
                <div key={set.id} className={`set-card ${theme.class}`}>
                  <div className="set-card-header">
                    <div className="set-card-icon">{theme.icon}</div>
                    <div className="set-card-title">{set.name}</div>
                    <div className={`status-pill ${status.type}`}>{status.text}</div>
                    <div className="set-card-desc">{set.desc}</div>
                  </div>
                  <div>
                    <div className="set-card-meta">
                      <span className="meta-pill">⏱ 80 Menit</span>
                      <span className="meta-pill">📝 56 Soal</span>
                      <span className="meta-pill">🇯🇵 Level N4</span>
                    </div>
                    <button className="btn-start" onClick={() => startTest(set)}>
                      {btnText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // B. RENDERING SIMULASI UJIAN (TEST INTERFACE DENGAN KEY RESETS)
  return (
    <TestInterface
      key={activeSet?.id}
      activeSet={activeSet}
      questions={questions}
      showFurigana={showFurigana}
      setShowFurigana={setShowFurigana}
      setView={setView}
    />
  );
}

// 6. TEST INTERFACE COMPONENT
function TestInterface({ activeSet, questions, showFurigana, setShowFurigana, setView }) {
  const DEFAULT_TIME = 80 * 60; // 80 menit dalam detik

  // 1. STATE MANAGEMENT (LOCAL TO TEST INTERFACE)
  const [answered, setAnswered] = useState(() => {
    const saved = localStorage.getItem(`n4_answers_${activeSet.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return {}; }
    }
    return {};
  });

  const [submitted, setSubmitted] = useState(() => {
    return localStorage.getItem(`n4_submitted_${activeSet.id}`) === 'true';
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const isSubmitted = localStorage.getItem(`n4_submitted_${activeSet.id}`) === 'true';
    if (isSubmitted) return 0;
    const savedTime = localStorage.getItem(`n4_time_${activeSet.id}`);
    if (savedTime !== null) {
      const parsed = parseInt(savedTime);
      return isNaN(parsed) || parsed <= 0 ? DEFAULT_TIME : parsed;
    }
    return DEFAULT_TIME;
  });

  const timerRef = useRef(null);
  const resultCardRef = useRef(null);

  // 2. TOTAL SOAL & SKOR
  const getTotalQuestions = () => {
    let total = 0;
    questions.forEach(sec => {
      sec.elements.forEach(el => {
        if (el.type === 'question') total++;
      });
    });
    return total;
  };

  const getCorrectCount = () => {
    let correct = 0;
    questions.forEach(sec => {
      sec.elements.forEach(el => {
        if (el.type === 'question') {
          const userAns = answered[el.num];
          if (userAns === el.answer) {
            correct++;
          }
        }
      });
    });
    return correct;
  };

  const totalQuestions = getTotalQuestions();
  const correctCount = getCorrectCount();
  const pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // 3. TIMER COUNTDOWN
  useEffect(() => {
    if (submitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          setSubmitted(true);
          localStorage.setItem(`n4_submitted_${activeSet.id}`, 'true');
          localStorage.setItem(`n4_score_${activeSet.id}`, `${correctCount}/${totalQuestions}`);
          return 0;
        }
        const newTime = prevTime - 1;
        localStorage.setItem(`n4_time_${activeSet.id}`, newTime);
        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [submitted, activeSet.id, correctCount, totalQuestions]);

  // 4. SCROLL KE HASIL AKHIR SETELAH SUBMIT
  useEffect(() => {
    if (submitted && resultCardRef.current) {
      resultCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [submitted]);

  // 5. FUNGSIONALITAS INTERAKSI
  const handleOptionClick = (qNum, val) => {
    if (submitted) return;
    const newAnswers = { ...answered, [qNum]: val };
    setAnswered(newAnswers);
    localStorage.setItem(`n4_answers_${activeSet.id}`, JSON.stringify(newAnswers));
  };

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    localStorage.setItem(`n4_submitted_${activeSet.id}`, 'true');
    localStorage.setItem(`n4_score_${activeSet.id}`, `${correctCount}/${totalQuestions}`);
  };

  const resetAll = () => {
    localStorage.removeItem(`n4_answers_${activeSet.id}`);
    localStorage.removeItem(`n4_submitted_${activeSet.id}`);
    localStorage.removeItem(`n4_time_${activeSet.id}`);
    localStorage.removeItem(`n4_score_${activeSet.id}`);
    
    setAnswered({});
    setSubmitted(false);
    setTimeLeft(DEFAULT_TIME);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id) => {
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 6. FORMAT JAM TIMER
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 7. EVALUASI NILAI
  const getEvaluation = () => {
    if (pct >= 90) return { label: '優秀！🎌', msg: 'すばらしい！N4合格レベルに達しています。本番も頑張って！' };
    if (pct >= 75) return { label: 'よくできました！', msg: 'いい調子です。まちがえたところを復習してもっと上を目指しましょう。' };
    if (pct >= 60) return { label: 'まあまあです', msg: '半分以上正解！間違いをチェックして、もう一度練習しましょう。' };
    if (pct >= 40) return { label: 'もう少し！', msg: '基礎をもう一度確認しましょう。あきらめないで続けることが大切 es です。' };
    return { label: 'がんばれ！', msg: '難しかったですね。間違いをよく読んで、また挑戦してください！' };
  };

  const getSectionCategory = (sectionId) => {
    if (sectionId === 's1' || sectionId === 's2') return 'mondai-kanji';
    if (sectionId === 's3' || sectionId === 's4' || sectionId === 's5') return 'mondai-kosakata';
    if (sectionId === 's6' || sectionId === 's7') return 'mondai-tata-bahasa';
    if (sectionId === 's8' || sectionId === 's9') return 'mondai-dokkai';
    return '';
  };

  const evaluation = getEvaluation();
  const isWarning = timeLeft <= 300; // Warning di bawah 5 menit

  return (
    <div className={showFurigana ? 'show-furigana' : ''}>
      {/* HEADER SIMULASI UJIAN */}
      <header className="site-header test-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => setView('home')}>
            <span className="back-arrow">←</span> Beranda
          </button>
          <h1>{activeSet?.name}</h1>
        </div>
        <div className="header-right">
          <button 
            className={`furigana-btn ${showFurigana ? 'active' : ''}`}
            onClick={() => {
              const newVal = !showFurigana;
              setShowFurigana(newVal);
              localStorage.setItem('n4_show_furigana', newVal ? 'true' : 'false');
            }}
            title="Aktifkan/Nonaktifkan Furigana"
          >
            <span className="furigana-icon">あ</span>
            <span>Furigana: {showFurigana ? 'Aktif' : 'Nonaktif'}</span>
          </button>
          <span className={`timer-pill ${isWarning ? 'warning' : ''}`} id="test-timer">
            <span className="timer-icon">⏱</span>
            <span id="timer-text">{formatTime(timeLeft)}</span>
          </span>
          <span className="score-pill" id="live-score">
            {submitted 
              ? `${correctCount} / ${totalQuestions} correct` 
              : `${Object.keys(answered).length} / ${totalQuestions} answered`}
          </span>
          <span className="badge">N4</span>
        </div>
      </header>

      {/* DAFTAR ISI (TOC) */}
      <div className="toc">
        <h2>▸ セクション一覧</h2>
        <div className="toc-grid">
          {questions.map(sec => (
            <div key={sec.sectionId} className={`toc-item ${getSectionCategory(sec.sectionId)}`} onClick={() => scrollToSection(`#${sec.sectionId}`)}>
              <span className="toc-label">{sec.sectionTitle}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KONTEN SOAL */}
      <div className="main-wrap">
        <div id="questions-container">
          {questions.map(sec => (
            <div key={sec.sectionId}>
              <div className="section-title" id={sec.sectionId}>{sec.sectionTitle}</div>
              {sec.instruction && (
                <div className="section-instruction">{sec.instruction}</div>
              )}
              {sec.elements.map((el, elIdx) => {
                if (el.type === 'passage') {
                  return (
                    <div key={`pass-${elIdx}`} className="passage" style={el.style ? { marginTop: '14px' } : {}}>
                      <div className="pass-label">{el.label}</div>
                      <div dangerouslySetInnerHTML={{ __html: el.content }} />
                    </div>
                  );
                }

                if (el.type === 'question') {
                  const optNums = ['１', '２', '３', '４'];
                  const userAns = answered[el.num];
                  const rightAns = el.answer;

                  return (
                    <div key={`q-${el.num}`} className={`q-card ${getSectionCategory(sec.sectionId)}`} data-answer={rightAns}>
                      <div className="q-header">
                        <span className="q-num">{el.num}</span>
                        <span className="q-text" dangerouslySetInnerHTML={{ __html: el.text }} />
                      </div>
                      <div className="options">
                        {el.options.map((opt, optIdx) => {
                          const val = optIdx + 1;
                          let btnClass = 'opt-btn';
                          
                          if (submitted) {
                            if (val === rightAns) {
                              btnClass += ' correct';
                            } else if (userAns === val && userAns !== rightAns) {
                              btnClass += ' wrong';
                            }
                          } else if (userAns === val) {
                            btnClass += ' selected';
                          }

                          return (
                            <button
                              key={`opt-${el.num}-${val}`}
                              className={btnClass}
                              disabled={submitted}
                              onClick={() => handleOptionClick(el.num, val)}
                            >
                              <span className="opt-num">{optNums[optIdx]}</span>
                              <span dangerouslySetInnerHTML={{ __html: opt }} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Umpan balik setelah disubmit */}
                      <div className={`q-feedback ${submitted ? 'show' : ''}`}>
                        {userAns === rightAns ? (
                          <span className="fb-ok">✔ せいかい！</span>
                        ) : (
                          <span className="fb-ng">
                            {userAns 
                              ? `✘ まちがい。せいかいは ${rightAns} です。` 
                              : `✘ みかいとう。せいかいは ${rightAns} です。`}
                          </span>
                        )}
                        <div className="fb-exp" dangerouslySetInnerHTML={{ __html: el.explanation }} />
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          ))}
        </div>

        {/* SUBMIT BUTTON ROW */}
        <div className="submit-row">
          <button className="btn-submit" id="btn-submit" disabled={submitted} onClick={handleSubmit}>
            答え合わせ -&gt;
          </button>
        </div>

        {/* KARTU EVALUASI SKOR HASIL AKHIR */}
        {submitted && (
          <div className="result-card show" id="result-card" ref={resultCardRef}>
            <div className="result-score" id="result-score">
              {correctCount}<span> / {totalQuestions}</span>
            </div>
            <div className="result-label" id="result-label">{evaluation.label}</div>
            <div className="result-msg" id="result-msg">{evaluation.msg}</div>
            <div className="pbar-wrap">
              <div className="pbar-fill" id="result-bar" style={{ width: `${pct}%` }}></div>
            </div>
            <button className="btn-reset" onClick={resetAll}>もう一度 ↺</button>
          </div>
        )}
      </div>
    </div>
  );
}
