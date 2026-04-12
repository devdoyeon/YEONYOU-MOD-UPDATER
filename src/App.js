import 'style/common.scss';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
// 일렉트론 기능을 리액트에서 안전하게 불러오기 (window.require 필수)
const { ipcRenderer } = window.require('electron');
const path = window.require('path');
const fs = window.require('fs-extra');
const AdmZip = window.require('adm-zip');

// GitHub 설정 (기존과 동일)
const GITHUB_USER = 'devdoyeon';
const REPO_NAME = 'YEONYOU-MMU';
const BRANCH = 'main';
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/${BRANCH}`;

const App = () => {
  // --- 상태 관리 (State) ---
  const [currentModsPath, setCurrentModsPath] = useState('');
  const [serverMods, setServerMods] = useState([]); // 서버 전체 목록
  const [localOwned, setLocalOwned] = useState([]); // 내 컴퓨터에 이미 있는 파일
  const [selectedToInstall, setSelectedToInstall] = useState([]); // 우측(설치예정) 리스트
  const [status, setStatus] = useState('준비 완료');
  const [showModal, setShowModal] = useState(true); // 설치 마법사 모달 제어

  // --- 1. 초기 데이터 로딩 ---
  useEffect(() => {
    const init = async () => {
      try {
        const defaultPath = await ipcRenderer.invoke('get-default-path');
        const modsPath = path.join(defaultPath, 'mods');
        setCurrentModsPath(modsPath);

        const res = await axios.get(
          `${RAW_URL}/renderer/version.json?c=${Date.now()}`
        );
        setServerMods(res.data.modList || []);
        setStatus(`서버 연결 완료 (v${res.data.version})`);
      } catch (e) {
        setStatus('서버 연결 실패');
      }
    };
    init();
  }, []);

  // --- 2. 로컬 파일 스캔 ---
  const scanLocalFiles = targetPath => {
    if (fs.existsSync(targetPath)) {
      const files = fs.readdirSync(targetPath).filter(f => f.endsWith('.jar'));
      setLocalOwned(files);
      setSelectedToInstall(files); // 진입 시 현재 보유 모드를 기본 선택값으로
    }
  };

  // --- 3. 모드 이동 로직 ---
  const moveToInstall = modName => {
    if (!selectedToInstall.includes(modName)) {
      setSelectedToInstall([...selectedToInstall, modName]);
    }
  };

  const moveToServer = modName => {
    setSelectedToInstall(selectedToInstall.filter(m => m !== modName));
  };

  // --- 4. 설치 로직 (개별 다운로드 방식 포함) ---
  const runInstall = async isFull => {
    if (!window.confirm('설치를 시작하시겠습니까?')) return;

    try {
      setStatus('설치 준비 중...');
      await fs.ensureDir(currentModsPath);
      await fs.emptyDir(currentModsPath);

      if (isFull) {
        // 전체 설치 로직 (압축파일 해제)
        setStatus('전체 모드 다운로드 중...');
        const res = await axios.get(`${RAW_URL}/renderer/version.json`);
        const zipRes = await axios.get(res.data.downloadUrl, {
          responseType: 'arraybuffer',
        });
        const zip = new AdmZip(Buffer.from(zipRes.data));
        zip.extractAllTo(currentModsPath, true);
      } else {
        // 선택 설치 로직 (하나씩 다운로드)
        for (let i = 0; i < selectedToInstall.length; i++) {
          const mod = selectedToInstall[i];
          setStatus(
            `다운로드 중: ${mod} (${i + 1}/${selectedToInstall.length})`
          );
          const fileUrl = `${RAW_URL}/mods/${encodeURIComponent(mod)}`;
          const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
          await fs.writeFile(path.join(currentModsPath, mod), res.data);
        }
      }

      alert('✅ 설치가 완료되었습니다!');
      window.close();
    } catch (e) {
      alert(`에러 발생: ${e.message}`);
      setStatus('설치 실패');
    }
  };

  // --- 5. 경로 변경 핸들러 ---
  const handleBrowse = async () => {
    const selected = await ipcRenderer.invoke('select-folder');
    if (selected) {
      setCurrentModsPath(selected);
      scanLocalFiles(selected);
    }
  };

  return (
    <div className='App'>
      {/* 1단계: 설치 방식 선택 모달 */}
      {showModal && (
        <div className='modal'>
          <div className='modal-content'>
            <h2>
              연유네 마인크래프트 서버
              <br />
              모드 매니저
            </h2>
            <button onClick={() => runInstall(true)}>전체 자동 설치</button>
            <button
              onClick={() => {
                setShowModal(false);
                scanLocalFiles(currentModsPath);
              }}>
              직접 선택 설치
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 메인 UI */}
      {!showModal && (
        <div className='main-container'>
          <div className='mod-comparison'>
            {/* 왼쪽 리스트 (미적용/삭제예정) */}
            <div className='mod-box'>
              <h3>미적용 모드 (서버)</h3>
              <ul>
                {[...new Set([...serverMods, ...localOwned])]
                  .filter(m => !selectedToInstall.includes(m))
                  .map(mod => (
                    <li
                      key={mod}
                      className={`mod-item ${localOwned.includes(mod) ? 'to-uninstall' : ''}`}
                      onClick={() => moveToInstall(mod)}>
                      {mod}
                    </li>
                  ))}
              </ul>
            </div>

            {/* 오른쪽 리스트 (설치예정) */}
            <div className='mod-box'>
              <h3>설치 예정 (내 컴퓨터)</h3>
              <ul>
                {selectedToInstall.map(mod => (
                  <li
                    key={mod}
                    className={`mod-item ${localOwned.includes(mod) ? 'owned' : ''}`}
                    onClick={() => moveToServer(mod)}>
                    {mod}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className='path-section'>
            <input type='text' value={currentModsPath} readOnly />
            <button onClick={handleBrowse}>경로 설정</button>
          </div>

          <footer>
            <span>{status}</span>
            <button className='success-btn' onClick={() => runInstall(false)}>
              동기화 및 설치
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};

export default App;
