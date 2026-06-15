import { useState, useEffect, useRef, useMemo } from 'react';

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

  // Flatten questions list for pagination
  const flatQuestions = useMemo(() => {
    const flat = [];
    questions.forEach(sec => {
      let activePassage = null;
      sec.elements.forEach(el => {
        if (el.type === 'passage') {
          activePassage = el;
        } else if (el.type === 'question') {
          flat.push({
            ...el,
            sectionId: sec.sectionId,
            sectionTitle: sec.sectionTitle,
            instruction: sec.instruction,
            passage: activePassage
          });
        }
      });
    });
    return flat;
  }, [questions]);

  const totalQuestions = flatQuestions.length;

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

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(() => {
    const isSubmitted = localStorage.getItem(`n4_submitted_${activeSet.id}`) === 'true';
    return isSubmitted ? 'results' : 'questions';
  });
  const [showNavigator, setShowNavigator] = useState(false);

  const timerRef = useRef(null);
  const resultCardRef = useRef(null);

  // 2. SKOR
  const getCorrectCount = () => {
    let correct = 0;
    flatQuestions.forEach(q => {
      const userAns = answered[q.num];
      if (userAns === q.answer) {
        correct++;
      }
    });
    return correct;
  };

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
          setActiveTab('results');
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

  // 4. SCROLL KE HASIL AKHIR SETELAH SUBMIT ATAU PINDAH TAB
  useEffect(() => {
    if (activeTab === 'results' && resultCardRef.current) {
      resultCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab, currentQuestionIndex]);

  // 5. FUNGSIONALITAS INTERAKSI
  const handleOptionClick = (qNum, val) => {
    if (submitted) return;
    const newAnswers = { ...answered, [qNum]: val };
    setAnswered(newAnswers);
    localStorage.setItem(`n4_answers_${activeSet.id}`, JSON.stringify(newAnswers));

    // Auto next after 350ms if not on the last question
    if (currentQuestionIndex < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 350);
    }
  };

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    setActiveTab('results');
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
    setCurrentQuestionIndex(0);
    setActiveTab('questions');
  };

  const jumpToSection = (sectionId) => {
    const firstQIdx = flatQuestions.findIndex(q => q.sectionId === sectionId);
    if (firstQIdx !== -1) {
      setActiveTab('questions');
      setCurrentQuestionIndex(firstQIdx);
    }
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
    if (pct >= 40) return { label: 'もう少し！', msg: '基礎をもう一度確認しましょう。あきらめないで続けることが大切です。' };
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

  const currentQ = flatQuestions[currentQuestionIndex];

  return (
    <div className={`test-app-container ${showFurigana ? 'show-furigana' : ''}`}>
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
              ? `${correctCount} / ${totalQuestions} benar` 
              : `${Object.keys(answered).length} / ${totalQuestions} dijawab`}
          </span>
          <span className="badge">N4</span>
        </div>
      </header>

      {/* MAIN CONTENT WRAPPER */}
      <div className="main-wrap centered-quiz-wrap">
        {/* SLIM PROGRESS BAR (PERSISTENT AT TOP OF WORKSPACE) */}
        <div className="progress-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${totalQuestions > 0 ? (Object.keys(answered).length / totalQuestions) * 100 : 0}%` }}
          />
        </div>

        {activeTab === 'results' ? (
          /* KARTU EVALUASI SKOR HASIL AKHIR */
          <div className="result-card show" id="result-card" ref={resultCardRef}>
            <div className="result-score" id="result-score">
              {correctCount}<span> / {totalQuestions}</span>
            </div>
            <div className="result-label" id="result-label">{evaluation.label}</div>
            <div className="result-msg" id="result-msg">{evaluation.msg}</div>
            <div className="pbar-wrap">
              <div className="pbar-fill" id="result-bar" style={{ width: `${pct}%` }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <button 
                className="btn-start" 
                style={{ maxWidth: '280px' }} 
                onClick={() => {
                  setActiveTab('questions');
                  setCurrentQuestionIndex(0);
                }}
              >
                Tinjau Pembahasan Soal →
              </button>
              <button className="btn-reset" onClick={resetAll}>Mulai Ulang Ujian ↺</button>
            </div>
          </div>
        ) : (
          /* SOAL VIEW */
          <div id="questions-container">
            {currentQ ? (
              <div>
                {/* SECTION HEADER */}
                <div className="question-section-header">
                  <div className="section-title">{currentQ.sectionTitle}</div>
                  {currentQ.instruction && (
                    <div className="section-instruction">{currentQ.instruction}</div>
                  )}
                </div>

                {/* PASSAGE (IF ANY) */}
                {currentQ.passage && (
                  <div className="passage">
                    <div className="pass-label">{currentQ.passage.label}</div>
                    <div dangerouslySetInnerHTML={{ __html: currentQ.passage.content }} />
                  </div>
                )}

                {/* QUESTION CARD */}
                {renderQuestionCard(currentQ)}

                {/* NAVIGATION CONTROLS */}
                <div className="nav-row">
                  <button 
                    className="nav-btn prev" 
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                  >
                    ← Sebelumnya
                  </button>
                  <span className="nav-indicator">
                    Soal {currentQuestionIndex + 1} dari {totalQuestions}
                  </span>
                  <button 
                    className="nav-btn next" 
                    disabled={currentQuestionIndex === totalQuestions - 1}
                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  >
                    Berikutnya →
                  </button>
                </div>

                {/* COLLAPSIBLE QUESTION NAVIGATOR ACCORDION */}
                <div className="navigator-section">
                  <button 
                    className={`btn-toggle-navigator ${showNavigator ? 'expanded' : ''}`}
                    onClick={() => setShowNavigator(!showNavigator)}
                  >
                    <span>📑 Navigasi Soal & Daftar Isi ({Object.keys(answered).length}/{totalQuestions})</span>
                    <span className="toggle-arrow">{showNavigator ? '▲' : '▼'}</span>
                  </button>

                  <div className={`navigator-panel ${showNavigator ? 'show' : ''}`}>
                    {/* SECTIONS LIST (TOC) INSIDE NAVIGATOR */}
                    <div className="toc-sub-section">
                      <h4>Daftar Bagian (Mondai):</h4>
                      <div className="toc-grid-minimal">
                        {questions.map(sec => (
                          <button 
                            key={sec.sectionId} 
                            className={`toc-item-minimal ${getSectionCategory(sec.sectionId)}`}
                            onClick={() => jumpToSection(sec.sectionId)}
                          >
                            {sec.sectionTitle}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* QUESTION GRID INSIDE NAVIGATOR */}
                    <div className="grid-sub-section">
                      <div className="grid-sub-header">
                        <h4>Pilih Nomor Soal:</h4>
                        {submitted && (
                          <button 
                            className="results-toggle-btn"
                            onClick={() => setActiveTab('results')}
                          >
                            📊 Ringkasan Hasil
                          </button>
                        )}
                      </div>
                      <div className="pagination-grid-minimal">
                        {flatQuestions.map((q, idx) => {
                          const isCurrent = activeTab === 'questions' && currentQuestionIndex === idx;
                          const isAnswered = answered[q.num] !== undefined;
                          const isCorrect = submitted && answered[q.num] === q.answer;
                          const isWrong = submitted && answered[q.num] !== undefined && answered[q.num] !== q.answer;

                          let btnClass = 'pag-item-minimal';
                          if (isCurrent) btnClass += ' current';
                          if (isAnswered) btnClass += ' answered';
                          if (submitted) {
                            if (isCorrect) btnClass += ' correct';
                            else if (isWrong) btnClass += ' wrong';
                            else btnClass += ' unanswered';
                          }

                          return (
                            <button
                              key={`pag-${q.num}`}
                              className={btnClass}
                              onClick={() => {
                                setActiveTab('questions');
                                setCurrentQuestionIndex(idx);
                              }}
                            >
                              {q.num}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON ROW */}
                {!submitted && (
                  <div className="submit-row">
                    <button className="btn-submit" id="btn-submit" onClick={handleSubmit}>
                      Selesai & Periksa Jawaban ✓
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>Tidak ada soal tersedia.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Helper render function for question card
  function renderQuestionCard(q) {
    const optNums = ['１', '２', '３', '４'];
    const userAns = answered[q.num];
    const rightAns = q.answer;

    return (
      <div className={`q-card ${getSectionCategory(q.sectionId)}`} data-answer={rightAns}>
        <div className="q-header">
          <span className="q-num">{q.num}</span>
          <span className="q-text" dangerouslySetInnerHTML={{ __html: q.text }} />
        </div>
        <div className="options">
          {q.options.map((opt, optIdx) => {
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
                key={`opt-${q.num}-${val}`}
                className={btnClass}
                disabled={submitted}
                onClick={() => handleOptionClick(q.num, val)}
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
          <div className="fb-exp" dangerouslySetInnerHTML={{ __html: q.explanation }} />
        </div>
      </div>
    );
  }
}
