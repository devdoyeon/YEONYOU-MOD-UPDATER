import { Octokit } from '@octokit/rest';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 1. 환경 변수 로드 (.env 파일의 GITHUB_TOKEN 읽기)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 설정 구간 ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'devdoyeon'; // 본인 깃허브 ID 확인
const REPO = 'YEONYOU-MOD-UPDATER'; // 본인 리포지토리 이름 확인
const MODS_DIR =
  'C:\\Users\\DOYEON\\curseforge\\minecraft\\Instances\\YEONYOU 1.20.1\\mods';

if (!GITHUB_TOKEN) {
  console.error('❌ 에러: .env 파일에 GITHUB_TOKEN이 없습니다.');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function publish() {
  const tagName = `v${Date.now()}`; // 고유 버전 태그 생성
  console.log(`📦 배포 준비 중... (버전: ${tagName})`);

  try {
    // 1. 커스포지 모드 목록 스캔
    const mods = fs.readdirSync(MODS_DIR).filter(f => f.endsWith('.jar'));
    console.log(`🔍 찾아낸 모드 개수: ${mods.length}개`);

    // 2. GitHub Release 생성
    console.log('🚀 GitHub Release 생성 중...');
    const { data: release } = await octokit.repos.createRelease({
      owner: OWNER,
      repo: REPO,
      tag_name: tagName,
      name: `Release ${tagName}`,
      body: `자동 업데이트 - ${new Date().toLocaleString()}`,
    });

    // 3. 모드 파일을 Release Asset으로 업로드
    for (const mod of mods) {
      const filePath = path.join(MODS_DIR, mod);
      const fileData = fs.readFileSync(filePath);

      console.log(`📤 업로드 중: ${mod}`);
      await octokit.repos.uploadReleaseAsset({
        owner: OWNER,
        repo: REPO,
        release_id: release.id,
        name: mod,
        data: fileData,
        headers: {
          'content-type': 'application/java-archive',
          'content-length': fileData.length,
        },
      });
    }

    // 4. public/version.json 업데이트 (App.js 참조용)
    const versionInfo = {
      version: tagName,
      modList: mods,
      // 중요: 이제 다운로드 경로는 릴리스 페이지가 됩니다.
      downloadBaseUrl: `https://github.com/${OWNER}/${REPO}/releases/download/${tagName}/`,
    };

    await fs.writeJson(
      path.join(__dirname, 'public', 'version.json'),
      versionInfo,
      { spaces: 2 }
    );
    console.log('📝 version.json 갱신 완료');

    // 5. GitHub에 version.json 푸시 (이 파일이 올라가야 유저 앱이 업데이트를 감지함)
    console.log('💾 변경사항(version.json) GitHub 푸시 중...');
    execSync('git add public/version.json');
    execSync(`git commit -m "Update version to ${tagName}"`);
    execSync('git push origin main');

    console.log(`\n✅ 배포 완료! 태그: ${tagName}`);
    console.log(`🔗 확인: https://github.com/${OWNER}/${REPO}/releases`);
  } catch (error) {
    console.error('❌ 배포 실패:', error.message);
    if (error.status === 401)
      console.error('💡 토큰 권한이나 값을 확인하세요!');
  }
}

publish();
