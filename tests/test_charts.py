import pandas as pd
import pytest

from src.dashboard.charts import (
    asr_by_owasp_bar,
    overall_passrate_pie,
    passrate_trend,
    severity_heatmap,
)


@pytest.fixture
def sample_df():
    return pd.DataFrame(
        [
            {"id": "c1", "category": "greetings", "answer_relevancy_score": 0.8},
            {"id": "c2", "category": "faq", "answer_relevancy_score": 0.6},
        ]
    )


def test_asr_by_owasp_bar(sample_df):
    fig = asr_by_owasp_bar(sample_df)
    assert fig is not None


def test_overall_passrate_pie(sample_df):
    fig = overall_passrate_pie(sample_df)
    assert fig is not None


def test_passrate_trend():
    runs = [{"label": "run1", "pass_rate": 0.8}, {"label": "run2", "pass_rate": 0.9}]
    fig = passrate_trend(runs)
    assert fig is not None


def test_severity_heatmap():
    data = [{"category": "crit", "count": 5}, {"category": "low", "count": 10}]
    fig = severity_heatmap(data)
    assert fig is not None
