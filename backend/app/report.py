"""Create a compact, readable QuantRisk portfolio PDF report."""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

NAVY = colors.HexColor('#17222e')
GREEN = colors.HexColor('#216b55')
GRAY = colors.HexColor('#596875')
LINE = colors.HexColor('#d8e2e1')


def _pct(value):
    return f'{float(value) * 100:,.2f}%'


def _table(rows, widths, compact=False):
    # Table cells are plain text, not Paragraph markup. Do not HTML-escape tickers.
    table = Table(rows, colWidths=widths, hAlign='LEFT', repeatRows=1)
    pad = 4 if compact else 6
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f2f6f5')]),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('TOPPADDING', (0, 0), (-1, -1), pad),
        ('BOTTOMPADDING', (0, 0), (-1, -1), pad),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('LINEBELOW', (0, -1), (-1, -1), 0.4, LINE),
    ]))
    return table


def _portfolio_table(portfolio, tickers):
    weights = portfolio.get('weights', [])
    if len(weights) != len(tickers):
        raise ValueError('Optimization weights do not match report tickers.')
    rows = [['Ticker', 'Weight']] + [
        [str(t), f'{float(w):.1f}%'] for t, w in zip(tickers, weights)
    ]
    return _table(rows, [3.5 * inch, 2.0 * inch], compact=len(tickers) >= 12)


def build_report(analysis, optimization=None):
    """Return PDF bytes; analysis is an AnalyzeResponse Pydantic instance."""
    if optimization and optimization.get('tickers') != analysis.tickers:
        raise ValueError('Optimization tickers do not match the analysis.')

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=(595.28, 841.89), leftMargin=45, rightMargin=45,
        topMargin=46, bottomMargin=46, title='QuantRisk Portfolio Report',
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='QRTitle', parent=styles['Title'], fontName='Helvetica-Bold',
        fontSize=23, textColor=NAVY, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        name='QRSub', parent=styles['Normal'], fontSize=9,
        textColor=GRAY, spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        name='QRHead', parent=styles['Heading2'], fontSize=12,
        textColor=GREEN, spaceBefore=11, spaceAfter=6, keepWithNext=True,
    ))
    styles.add(ParagraphStyle(
        name='QRBody', parent=styles['Normal'], fontSize=8.5,
        leading=12, textColor=NAVY, spaceAfter=5,
    ))

    n = len(analysis.tickers)
    story = [
        Paragraph('QuantRisk', styles['QRTitle']),
        Paragraph('NSE Portfolio Desk  |  Historical Portfolio Risk Report', styles['QRSub']),
        Paragraph(
            f'Sample: {escape(str(analysis.start_date))} to {escape(str(analysis.end_date))}  |  '
            f'{analysis.observation_count} daily returns  |  Risk-free rate: {_pct(analysis.risk_free_rate)}',
            styles['QRBody'],
        ),
        Paragraph('Selected allocation', styles['QRHead']),
        _table(
            [['Ticker', 'Weight']] + [[str(t), f'{float(w):.2f}%'] for t, w in zip(analysis.tickers, analysis.weights)],
            [3.5 * inch, 2.0 * inch], compact=n >= 12,
        ),
    ]

    m = analysis.metrics
    metrics_table = _table([
        ['Metric', 'Value'],
        ['Annualized compounded return', _pct(m.annualized_return)],
        ['Annualized volatility', _pct(m.annualized_volatility)],
        ['Sharpe ratio', f'{m.sharpe_ratio:.2f}'],
        ['Maximum drawdown', _pct(m.max_drawdown)],
        ['1-day historical 95% VaR', _pct(m.var_95_1d)],
    ], [3.5 * inch, 2.0 * inch], compact=n >= 12)
    story.append(KeepTogether([Paragraph('Historical risk statistics', styles['QRHead']), metrics_table]))

    if optimization:
        for key, label in [
            ('minimum_volatility', 'Minimum-volatility allocation'),
            ('maximum_sharpe', 'Maximum-Sharpe allocation'),
        ]:
            portfolio = optimization.get(key)
            if not portfolio:
                continue
            if n >= 12:
                story.append(PageBreak())
            sharpe = portfolio.get('sharpe_ratio')
            sharpe_text = f'{float(sharpe):.2f}' if sharpe is not None else 'N/A'
            details = (
                f"Expected arithmetic return: {_pct(portfolio['annualized_return'])}  |  "
                f"Volatility: {_pct(portfolio['annualized_volatility'])}  |  "
                f"Sharpe: {sharpe_text}"
            )
            story.extend([
                Paragraph(label, styles['QRHead']),
                Paragraph(escape(details), styles['QRBody']),
                _portfolio_table(portfolio, analysis.tickers),
            ])
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            'Optimization uses annualized arithmetic mean returns and sample covariance; '
            'the dashboard annualized return is geometric, so they are not directly comparable.',
            styles['QRBody'],
        ))

    assumptions = [Paragraph('&#8226; ' + escape(str(a)), styles['QRBody']) for a in analysis.assumptions]
    methodology = [Paragraph('Methodology and limitations', styles['QRHead']), *assumptions,
                   Paragraph(escape(str(analysis.disclaimer)), styles['QRBody'])]
    # Keep the heading with the first bullet; allow the rest to flow if needed.
    story.extend(methodology)

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(45, 38, 550, 38)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(GRAY)
        canvas.drawString(45, 26, 'QuantRisk  |  Educational analysis, not investment advice')
        canvas.drawRightString(550, 26, f'Page {document.page}')
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
