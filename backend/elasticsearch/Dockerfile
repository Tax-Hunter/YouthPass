# 정책 검색용 Elasticsearch (Railway 배포).
#
# 버전은 3중 일치가 필수 — 서버 = analysis-nori 플러그인 = 클라이언트
# (backend/requirements.txt의 elasticsearch==8.19.3). 올릴 때 세 곳을 함께 올린다.
FROM docker.elastic.co/elasticsearch/elasticsearch:8.19.3

# 공식 이미지에는 한국어 형태소 분석기가 없어 nori를 추가 설치한다
# (app/core/es_schema.py의 korean_index/korean_search 분석기가 이 플러그인에 의존).
RUN bin/elasticsearch-plugin install --batch analysis-nori

# Railway 프라이빗 네트워킹은 IPv6 전용이라 기본값(0.0.0.0)으로는 다른 서비스가 접속하지 못한다.
# 환경변수(network.host)로 주면 ES가 overrides.yml에 그대로 기록하는데 맨 `::`는 YAML 파싱
# 오류로 기동 실패하고(실측), `[::]`도 flow node 오류가 난다. 따옴표를 포함한 값만 유효하므로
# UI 입력 실수를 원천 차단하기 위해 이미지에 굽는다. `::`는 듀얼스택이라 IPv4 접속도 된다.
RUN sed -i 's/^network\.host:.*/network.host: "::"/' config/elasticsearch.yml
