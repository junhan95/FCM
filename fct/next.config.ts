import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 설치본(Windows 인스톨러)에서 쓰는 자체 실행 서버.
  // .next/standalone 에 필요한 모듈만 모아 주므로 node_modules 전체를 배포하지 않아도 된다.
  output: "standalone",
};

export default nextConfig;
