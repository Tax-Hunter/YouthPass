from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from app.db.session import Base


class PolicySummary(Base):
    """정책 AI 요약 (policy 1:1 수직분할, Claude 배치 생성 — ingest.summarizer).

    policy 컬럼 확장이 아닌 별도 테이블인 이유:
    ① loader._upsert_policy가 Policy 전컬럼을 SET하므로 policy에 컬럼을 추가하면
       transform이 값을 만들지 않는 한 매 동기화 때 덮어써질 위험
    ② 모델/프롬프트 교체 시 이 테이블만 재생성하면 됨
    ③ ES 색인 대상(검색 필드)과 표시용 데이터를 분리

    재요약 판정: source_hash != policy.content_hash (summarizer가 증분 선별).
    실패분은 source_hash가 갱신되지 않아 다음 크론에서 자동 재시도된다.
    """

    __tablename__ = "policy_summary"

    plcy_no = Column(
        String(30),
        ForeignKey("policy.plcy_no", ondelete="CASCADE"),
        primary_key=True,
    )
    one_liner = Column(String(80), nullable=False)     # 카드용 한 줄 요약 ("누가 무엇을 받는다")
    benefit = Column(Text)                             # 받는 혜택 1~2문장 (금액·기간 포함)
    target = Column(Text)                              # 받을 수 있는 사람 1~2문장
    how_to_apply = Column(Text)                        # 신청 방법 (원문에 없으면 NULL)
    source_hash = Column(String(32), nullable=False)   # 생성 시점의 policy.content_hash
    model = Column(String(40), nullable=False)         # 생성에 사용한 Claude 모델 ID
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
