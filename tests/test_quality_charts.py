"""Tests for src/dashboard/quality_charts.py"""

import pandas as pd
import plotly.graph_objects as go
import pytest

from src.dashboard.quality_charts import (
    ar_by_category_bar,
    ar_distribution_histogram,
    faithfulness_vs_relevancy_scatter,
    quality_trend_line,
)


@pytest.fixture
def sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "session_id": "s1",
                "category": "greetings",
                "user_query": "What is AI?",
                "answer_relevancy_score": 0.85,
                "answer_relevancy_passed": True,
                "faithfulness_score": 0.9,
                "faithfulness_passed": True,
            },
            {
                "session_id": "s2",
                "category": "greetings",
                "user_query": "How are you?",
                "answer_relevancy_score": 0.6,
                "answer_relevancy_passed": False,
                "faithfulness_score": None,
                "faithfulness_passed": None,
            },
            {
                "session_id": "s3",
                "category": "faq",
                "user_query": "What is your name?",
                "answer_relevancy_score": 0.75,
                "answer_relevancy_passed": True,
                "faithfulness_score": 0.8,
                "faithfulness_passed": True,
            },
        ]
    )


@pytest.fixture
def sample_runs() -> list[dict]:
    return [
        {"label": "20260101_run1 | AR=0.7 | pass=80%", "ar_mean": 0.7, "pass_rate": 0.8},
        {"label": "20260102_run2 | AR=0.75 | pass=85%", "ar_mean": 0.75, "pass_rate": 0.85},
        {"label": "20260103_run3 | AR=0.8 | pass=90%", "ar_mean": 0.8, "pass_rate": 0.9},
    ]


def test_ar_by_category_bar_not_empty(sample_df):
    fig = ar_by_category_bar(sample_df)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) > 0


def test_ar_by_category_bar_empty_df():
    fig = ar_by_category_bar(pd.DataFrame())
    assert isinstance(fig, go.Figure)
    assert "нет данных" in fig.layout.title.text.lower()


def test_ar_by_category_bar_no_category_column():
    df = pd.DataFrame([{"answer_relevancy_score": 0.8}])
    fig = ar_by_category_bar(df)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) > 0


def test_ar_by_category_bar_categories_in_data(sample_df):
    fig = ar_by_category_bar(sample_df)
    bar_trace = fig.data[0]
    assert hasattr(bar_trace, "y")
    categories = list(bar_trace.y)
    assert "greetings" in categories
    assert "faq" in categories


def test_ar_distribution_histogram(sample_df):
    fig = ar_distribution_histogram(sample_df)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) > 0


def test_ar_distribution_histogram_with_category(sample_df):
    fig = ar_distribution_histogram(sample_df, category="greetings")
    assert isinstance(fig, go.Figure)
    assert "greetings" in fig.layout.title.text


def test_ar_distribution_histogram_empty_df():
    fig = ar_distribution_histogram(pd.DataFrame())
    assert isinstance(fig, go.Figure)
    assert "нет данных" in fig.layout.title.text.lower()


def test_quality_trend_line_empty():
    fig = quality_trend_line([])
    assert isinstance(fig, go.Figure)
    assert "нет данных" in fig.layout.title.text.lower()


def test_quality_trend_line_with_data(sample_runs):
    fig = quality_trend_line(sample_runs)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) >= 1
    assert len(fig.data) == 2


def test_quality_trend_line_single_run():
    runs = [{"label": "run1 | AR=0.7 | pass=80%", "ar_mean": 0.7, "pass_rate": 0.8}]
    fig = quality_trend_line(runs)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) > 0


def test_faithfulness_vs_relevancy_scatter(sample_df):
    fig = faithfulness_vs_relevancy_scatter(sample_df)
    assert isinstance(fig, go.Figure)
    assert len(fig.data) > 0


def test_faithfulness_vs_relevancy_scatter_no_faithfulness():
    df = pd.DataFrame(
        [
            {"answer_relevancy_score": 0.8, "faithfulness_score": None},
            {"answer_relevancy_score": 0.7, "faithfulness_score": None},
        ]
    )
    fig = faithfulness_vs_relevancy_scatter(df)
    assert isinstance(fig, go.Figure)
    assert "нет данных" in fig.layout.title.text.lower()


def test_faithfulness_vs_relevancy_scatter_empty_df():
    fig = faithfulness_vs_relevancy_scatter(pd.DataFrame())
    assert isinstance(fig, go.Figure)
    assert "нет данных" in fig.layout.title.text.lower()
