"""Curated SEC filing extracts for the Financial Research Intelligence Platform demo.

Each company has a small set of representative paragraphs drawn from public 10-K / 10-Q
filings (MD&A, Risk Factors, Financial Highlights). These are intentionally short, factual
excerpts suitable for RAG demonstration. In production, this would be replaced by a
pipeline that ingests live SEC EDGAR filings.
"""

COMPANIES = [
    {"ticker": "AAPL", "name": "Apple Inc.", "cik": "0000320193", "sector": "Technology"},
    {"ticker": "MSFT", "name": "Microsoft Corporation", "cik": "0000789019", "sector": "Technology"},
    {"ticker": "GOOGL", "name": "Alphabet Inc.", "cik": "0001652044", "sector": "Technology"},
    {"ticker": "AMZN", "name": "Amazon.com Inc.", "cik": "0001018724", "sector": "Consumer / Tech"},
    {"ticker": "TSLA", "name": "Tesla, Inc.", "cik": "0001318605", "sector": "Automotive / Tech"},
    {"ticker": "NVDA", "name": "NVIDIA Corporation", "cik": "0001045810", "sector": "Semiconductors"},
    {"ticker": "META", "name": "Meta Platforms, Inc.", "cik": "0001326801", "sector": "Technology"},
    {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "cik": "0000019617", "sector": "Financials"},
    {"ticker": "BAC", "name": "Bank of America Corporation", "cik": "0000070858", "sector": "Financials"},
    {"ticker": "BRK.B", "name": "Berkshire Hathaway Inc.", "cik": "0001067983", "sector": "Conglomerate"},
]

# Each chunk: {form, section, period, text}
CORPUS = {
    "AAPL": [
        {"form": "10-K", "section": "Item 1 — Business", "period": "FY2024",
         "text": "Apple Inc. designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services. The Company's fiscal year is the 52- or 53-week period that ends on the last Saturday of September."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "The Company's business, results of operations, financial condition and stock price can be affected by a number of factors, many of which are beyond the Company's control, including macroeconomic and geopolitical conditions, supply chain concentration in Asia (particularly China), and dependence on a small number of carriers and resellers for the distribution of its products."},
        {"form": "10-K", "section": "MD&A — Net Sales", "period": "FY2024",
         "text": "Total net sales for fiscal 2024 were $391.0 billion, an increase of 2% compared to fiscal 2023. iPhone net sales were $201.2 billion (essentially flat year-over-year). Services net sales grew 13% to $96.2 billion, a record. Wearables, Home and Accessories declined 7% to $37.0 billion."},
        {"form": "10-K", "section": "MD&A — Gross Margin", "period": "FY2024",
         "text": "Total gross margin percentage was 46.2% for fiscal 2024, up from 44.1% in fiscal 2023. Products gross margin was 37.2% (vs 36.5% in FY2023). Services gross margin was 73.9% (vs 70.8% in FY2023), reflecting the favorable mix shift toward higher-margin services."},
        {"form": "10-Q", "section": "MD&A — Q1 Highlights", "period": "Q1 FY2025",
         "text": "For the three months ended December 28, 2024, total net sales were $124.3 billion, an increase of 4% compared to the prior year quarter. iPhone revenue was $69.1 billion. Services reached an all-time high of $26.3 billion, up 14%."},
        {"form": "10-Q", "section": "MD&A — Q2 Highlights", "period": "Q2 FY2025",
         "text": "For the three months ended March 29, 2025, total net sales were $95.4 billion, an increase of 5% year-over-year, driven by Services growth and improving Mac and iPad performance. Gross margin was 47.1%, reflecting continued Services mix benefit."},
    ],
    "MSFT": [
        {"form": "10-K", "section": "Item 1 — Business", "period": "FY2024",
         "text": "Microsoft Corporation develops and supports software, services, devices and solutions. The Company reports three operating segments: Productivity and Business Processes, Intelligent Cloud, and More Personal Computing."},
        {"form": "10-K", "section": "MD&A — Revenue", "period": "FY2024",
         "text": "Total revenue for fiscal 2024 was $245.1 billion, an increase of 16% compared to fiscal 2023. Intelligent Cloud revenue grew 20% to $105.4 billion, led by Azure and other cloud services growth of 30%. Productivity and Business Processes increased 12% to $77.7 billion."},
        {"form": "10-K", "section": "MD&A — Operating Income", "period": "FY2024",
         "text": "Operating income increased 24% to $109.4 billion. Operating margin expanded to 44.6% from 41.8% in the prior year, primarily reflecting strong cloud growth and operating leverage despite increased capital expenditures for AI infrastructure."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "We make significant investments in new products and services that may not achieve expected returns, including substantial commitments to AI infrastructure and Generative AI capabilities. Datacenter capacity constraints and the cost and availability of GPUs may impact our ability to meet Azure AI demand."},
        {"form": "10-Q", "section": "MD&A — Q1 FY2025", "period": "Q1 FY2025",
         "text": "Revenue for the quarter ended September 30, 2024 was $65.6 billion, up 16% year-over-year. Microsoft Cloud revenue was $38.9 billion, up 22%. Azure and other cloud services revenue grew 33%."},
    ],
    "GOOGL": [
        {"form": "10-K", "section": "MD&A — Revenue", "period": "FY2024",
         "text": "Alphabet's consolidated revenues for 2024 were $350.0 billion, an increase of 14% year over year. Google Services revenue was $304.9 billion (up 13%), driven by Google Search & other advertising. Google Cloud revenue was $43.2 billion, up 31%."},
        {"form": "10-K", "section": "MD&A — Operating Margin", "period": "FY2024",
         "text": "Consolidated operating income was $112.4 billion, with an operating margin of 32.1%, up from 27.4% in 2023. Google Cloud operating margin reached 14.1% from 5.8%, reflecting scale benefits and improved utilization."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "We face intense competition from companies and entities offering AI-driven search and conversational experiences. Our results depend significantly on advertising revenue, which is sensitive to macroeconomic conditions. Regulatory scrutiny, including antitrust investigations in the U.S. and EU, may result in adverse outcomes."},
        {"form": "10-Q", "section": "MD&A — Q3 2024", "period": "Q3 2024",
         "text": "Revenues for Q3 2024 were $88.3 billion, up 15%. Google Cloud revenue was $11.4 billion, up 35%, with operating income of $1.95 billion. YouTube ads revenue was $8.9 billion, up 12%."},
    ],
    "AMZN": [
        {"form": "10-K", "section": "MD&A — Net Sales", "period": "FY2024",
         "text": "Net sales for 2024 were $638.0 billion, an increase of 11% compared to $574.8 billion in 2023. North America segment sales increased 10% to $387.5 billion, International increased 9% to $142.9 billion, and AWS increased 19% to $107.6 billion."},
        {"form": "10-K", "section": "MD&A — Operating Income", "period": "FY2024",
         "text": "Operating income for 2024 was $68.6 billion, more than double 2023's $36.9 billion. AWS operating income was $39.8 billion (operating margin 37.0%). North America operating income improved to $25.0 billion."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "Our expansion places a significant strain on management, operational, financial and other resources. We are subject to risks related to international operations, including currency fluctuations and trade restrictions. We face significant competition across all our businesses."},
    ],
    "TSLA": [
        {"form": "10-K", "section": "MD&A — Automotive Revenue", "period": "FY2024",
         "text": "Total revenues for 2024 were $97.7 billion, up 1% year-over-year. Automotive revenues were $77.1 billion, a decrease of 6%, reflecting lower average selling prices partially offset by higher deliveries. Energy generation and storage revenue grew 67% to $10.1 billion."},
        {"form": "10-K", "section": "MD&A — Gross Margin", "period": "FY2024",
         "text": "Total GAAP gross margin was 17.9% in 2024, down from 18.2% in 2023. Automotive gross margin (excluding regulatory credits) was approximately 13.6%, reflecting pricing actions to sustain volume. Energy storage gross margin reached 26.2%."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "Our future growth depends on consumer demand for electric vehicles in a market increasingly competitive on price and features. We face risks from supply chain dependencies on lithium, nickel and other battery materials, and from execution of FSD and robotaxi programs."},
    ],
    "NVDA": [
        {"form": "10-K", "section": "MD&A — Revenue", "period": "FY2025",
         "text": "Revenue for fiscal 2025 was $130.5 billion, up 114% from $60.9 billion in fiscal 2024. Data Center revenue was $115.2 billion, an increase of 142%, driven by demand for the Hopper and Blackwell GPU architectures from hyperscalers and AI builders."},
        {"form": "10-K", "section": "MD&A — Gross Margin", "period": "FY2025",
         "text": "GAAP gross margin for fiscal 2025 was 75.0%, up from 72.7% in fiscal 2024. Non-GAAP gross margin was 75.5%. Gross margin expansion reflected higher Data Center mix and favorable pricing on accelerated computing platforms."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2025",
         "text": "Our business and operating results are highly dependent on demand for AI infrastructure and could be adversely affected if customer demand patterns shift. We rely on a limited number of foundry partners, particularly TSMC, for manufacturing capacity."},
        {"form": "10-Q", "section": "MD&A — Q2 FY2026", "period": "Q2 FY2026",
         "text": "Revenue for the quarter ended July 27, 2025 was $46.7 billion, up 56% year over year. Data Center revenue was $41.1 billion. Blackwell-architecture revenue ramped meaningfully across hyperscaler customers."},
    ],
    "META": [
        {"form": "10-K", "section": "MD&A — Revenue", "period": "FY2024",
         "text": "Total revenue for 2024 was $164.5 billion, up 22% year over year. Family of Apps revenue was $162.4 billion (up 22%), driven by advertising. Reality Labs revenue was $2.1 billion."},
        {"form": "10-K", "section": "MD&A — Operating Margin", "period": "FY2024",
         "text": "Income from operations was $69.4 billion, with an operating margin of 42.2%, up from 34.7% in 2023. Reality Labs operating loss was $17.7 billion, reflecting continued investment in metaverse and AR hardware."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "We expect significant year-over-year growth in infrastructure expense as we invest in AI capacity. Our advertising business depends on user engagement and the effectiveness of ad targeting, which is subject to platform policy changes (e.g., iOS ATT) and evolving regulation."},
    ],
    "JPM": [
        {"form": "10-K", "section": "MD&A — Net Revenue", "period": "FY2024",
         "text": "JPMorgan Chase reported managed net revenue of $177.4 billion for 2024, up 10% from $161.4 billion in 2023. Net interest income was $94.1 billion, up 5%. Noninterest revenue was $83.4 billion, up 17%."},
        {"form": "10-K", "section": "MD&A — Net Income", "period": "FY2024",
         "text": "Net income for 2024 was $58.5 billion, up 18% from $49.6 billion in 2023. Return on tangible common equity was 22%. CET1 capital ratio was 15.7% at year-end."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "We face credit risk from consumer and wholesale exposures sensitive to macroeconomic conditions, including commercial real estate. We are subject to extensive regulation, including Basel III endgame capital requirements that could increase capital needed against market and operational risk."},
    ],
    "BAC": [
        {"form": "10-K", "section": "MD&A — Revenue", "period": "FY2024",
         "text": "Bank of America reported total revenue, net of interest expense, of $101.9 billion for 2024, up 2% from $98.6 billion. Net interest income was $55.7 billion. Noninterest income was $46.2 billion."},
        {"form": "10-K", "section": "MD&A — Net Income", "period": "FY2024",
         "text": "Net income for 2024 was $27.1 billion, or $3.21 per diluted share. Return on average common equity was 9.3%. CET1 ratio was 11.9% under the standardized approach."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "We are exposed to interest rate risk on our securities portfolio, with significant unrealized losses on held-to-maturity securities. Credit losses on commercial real estate, particularly office, may increase under a sustained higher-for-longer interest rate environment."},
    ],
    "BRK.B": [
        {"form": "10-K", "section": "MD&A — Revenue", "period": "FY2024",
         "text": "Berkshire Hathaway's revenues for 2024 were $371.4 billion, up from $364.5 billion in 2023. Insurance premiums earned and investment income contributed materially; BNSF railroad and Berkshire Hathaway Energy were the largest non-insurance segments."},
        {"form": "10-K", "section": "MD&A — Operating Earnings", "period": "FY2024",
         "text": "Operating earnings (excluding investment gains) for 2024 were approximately $47.4 billion. Insurance underwriting profit improved meaningfully driven by GEICO turnaround. Cash and Treasury bill holdings at year-end were $334 billion."},
        {"form": "10-K", "section": "Item 1A — Risk Factors", "period": "FY2024",
         "text": "Our insurance subsidiaries are exposed to catastrophe risk, including hurricanes, earthquakes and wildfires. A substantial portion of our equity investment portfolio is concentrated in a small number of holdings, exposing us to single-issuer market risk."},
    ],
}


def get_company_by_ticker(ticker: str):
    for c in COMPANIES:
        if c["ticker"] == ticker:
            return c
    return None
