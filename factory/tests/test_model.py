"""Expected values below are worked out by hand from examples/example_product.toml."""

import unittest

from helpers import EXAMPLE, by_id, evaluate_with
from unit_economics import evaluate, load_config, metrics, run_sensitivities
from unit_economics.model import cheapest_combination, cheapest_same_size_multiple


class CostBuildupTest(unittest.TestCase):
    def test_buildup(self):
        c = evaluate(load_config(EXAMPLE)).cost
        self.assertEqual((c.landed, c.components_total, c.all_in), (40, 10, 50))
        self.assertEqual(c.loaded, {"offline": 50, "online": 45})  # field sales applies offline only
        self.assertTrue(c.within_planning_range)


class OfflineTest(unittest.TestCase):
    def setUp(self):
        self.routes = evaluate(load_config(EXAMPLE)).routes

    def test_direct_route(self):
        r = by_id(self.routes, "direct_70")
        self.assertEqual((r.realization, r.retailer_cost, r.retailer_margin), (70, 70, 30))
        self.assertAlmostEqual(r.retailer_margin_pct, 0.30)
        self.assertIsNone(r.distributor_margin)
        self.assertEqual((r.gross_contribution, r.contribution), (30, 20))
        self.assertAlmostEqual(r.gross_margin_pct, 30 / 70)

    def test_distributor_route(self):
        r = by_id(self.routes, "dist_60")
        self.assertEqual((r.realization, r.retailer_cost, r.distributor_margin), (60, 70, 10))
        self.assertAlmostEqual(r.distributor_margin_pct, 10 / 70)
        self.assertEqual((r.gross_contribution, r.contribution), (20, 10))

    def test_free_goods_scheme(self):
        r = by_id(self.routes, "direct_70_scheme")
        self.assertAlmostEqual(r.realization, 700 / 11)  # 10 paid, 11 shipped
        self.assertAlmostEqual(r.retailer_margin, 100 - 700 / 11)
        self.assertAlmostEqual(r.contribution, 700 / 11 - 50)

    def test_gst_is_removed_from_realization(self):
        r = by_id(evaluate_with({"product.gst_rate": 0.25}).routes, "direct_70")
        self.assertAlmostEqual(r.net_realization, 56)
        self.assertAlmostEqual(r.contribution, 6)


class OnlineTest(unittest.TestCase):
    def setUp(self):
        self.offers = evaluate(load_config(EXAMPLE)).offers

    def test_single_pays_shipping_fee_and_loses_money_after_cac(self):
        o = by_id(self.offers, "single")
        self.assertEqual((o.shipping_fee_income, o.order_value), (30, 129))
        self.assertAlmostEqual(o.lines[2].amount, 2.58)  # 2% of 129
        self.assertAlmostEqual(o.total_cost, 138.58)
        self.assertAlmostEqual(o.contribution, -9.58)
        self.assertAlmostEqual(o.contribution_before_marketing, 30.42)
        self.assertAlmostEqual(o.cac_payback_orders, 40 / 30.42)
        self.assertAlmostEqual(o.break_even_shipping, 40.42)

    def test_three_pack(self):
        o = by_id(self.offers, "trio")
        self.assertEqual((o.shipping_fee_income, o.mrp_value), (0, 300))
        self.assertAlmostEqual(o.discount_vs_mrp, 0.10)
        self.assertAlmostEqual(o.total_cost, 223.4)  # 120 + 50 + 5 + 5.4 + 40 + 3
        self.assertAlmostEqual(o.contribution, 46.6)
        self.assertAlmostEqual(o.contribution_per_unit, 46.6 / 3)
        self.assertAlmostEqual(o.contribution_margin, 46.6 / 270)

    def test_bigger_packs(self):
        self.assertAlmostEqual(by_id(self.offers, "six").contribution, 168.6)
        self.assertAlmostEqual(by_id(self.offers, "twelve").contribution, 442.0)

    def test_loaded_cost_basis(self):
        o = by_id(evaluate_with({"online.web.unit_cost_basis": "loaded"}).offers, "trio")
        self.assertEqual(o.unit_cost, 45)
        self.assertAlmostEqual(o.contribution, 31.6)

    def test_irrecoverable_input_gst_only_on_flagged_lines(self):
        o = by_id(evaluate_with({"online.web.irrecoverable_input_gst": 0.18}).offers, "trio")
        amounts = {line.id: line.amount for line in o.lines}
        self.assertAlmostEqual(amounts["shipping"], 59)
        self.assertAlmostEqual(amounts["payment"], 6.372)
        self.assertAlmostEqual(amounts["cac"], 47.2)
        self.assertAlmostEqual(amounts["packaging"], 5)  # not flagged
        self.assertAlmostEqual(o.contribution, 29.428)

    def test_offer_losing_money_before_marketing(self):
        results = evaluate_with({"online.web.offers.single.price": 20})
        o = by_id(results.offers, "single")
        self.assertLess(o.contribution_before_marketing, 0)
        self.assertIsNone(o.cac_payback_orders)
        codes = {(f.code, f.ref) for f in results.findings}
        self.assertIn(("ONLINE_LOSS_BEFORE_MARKETING", "web.single"), codes)


class LadderTest(unittest.TestCase):
    def rows(self, results, card):
        return {r.offer_id: r for r in results.ladders if r.card_id == card}

    def test_twelve_pack_dominated_by_two_six_packs(self):
        rows = self.rows(evaluate(load_config(EXAMPLE)), "full")
        twelve = rows["twelve"]
        self.assertEqual((twelve.alt_best, twelve.alt_best_combo), (1040, "2 × 6-pack"))
        self.assertEqual(twelve.saving, -10)
        self.assertTrue(twelve.dominated)
        self.assertFalse(rows["six"].dominated)
        self.assertEqual(rows["trio"].alt_best, 297)
        self.assertIsNone(rows["single"].alt_best)

    def test_core_card_is_clean(self):
        rows = self.rows(evaluate(load_config(EXAMPLE)), "core")
        self.assertFalse(any(r.dominated for r in rows.values()))

    def test_shipping_fee_counts_and_ties_are_dominated(self):
        # three singles at 80 = 240, below the 250 threshold, so the customer adds the 30 fee: 270 = the 3-pack price
        trio = self.rows(evaluate_with({"online.web.offers.single.price": 80}), "core")["trio"]
        self.assertEqual((trio.alt_best, trio.alt_total, trio.saving), (240, 270, 0))
        self.assertTrue(trio.dominated)

    def test_mixed_combinations(self):
        options = [("A", 1, 10.0), ("B", 4, 30.0), ("C", 6, 40.0)]
        self.assertEqual(cheapest_combination(10, options), (70.0, "1 × B + 1 × C"))
        self.assertEqual(cheapest_same_size_multiple(10, options), (100.0, "10 × A"))
        self.assertEqual(cheapest_combination(7, [("B", 4, 1.0), ("C", 6, 1.0)]), (None, ""))


class ScenarioTest(unittest.TestCase):
    def test_mix_and_input_realization(self):
        month, small = evaluate(load_config(EXAMPLE)).scenarios
        self.assertEqual((month.realization, month.realization_source), (75, "mix"))
        self.assertEqual((month.revenue, month.gross_contribution, month.opex_total), (75000, 35000, 19000))
        self.assertEqual(month.operating_contribution, 16000)
        self.assertEqual((month.implied_cost_per_unit, month.implied_cost_excl_marketing), (59, 49))
        self.assertEqual((small.realization_source, small.operating_contribution), ("input", 13000))


class FindingsTest(unittest.TestCase):
    def test_expected_findings(self):
        results = evaluate(load_config(EXAMPLE))
        found = {(f.code, f.ref) for f in results.findings}
        self.assertEqual(
            found,
            {
                ("LADDER_DOMINATED", "web.full.twelve"),
                ("ONLINE_BELOW_TARGET", "web.single"),
                ("OFFLINE_BELOW_TARGET", "dist_60"),
                ("OFFLINE_BELOW_TARGET", "direct_70_scheme"),
                ("GROSS_MARGIN_BELOW_TARGET", "dist_60"),
                ("RETAILER_MARGIN_OUTSIDE_BAND", "direct_70_scheme"),
                ("SCENARIO_COST_ABOVE_PLANNING", "month"),
            },
        )
        severities = [f.severity for f in results.findings]
        self.assertEqual(severities, sorted(severities, key=["error", "warning", "info"].index))

    def test_negative_distributor_margin_is_an_error(self):
        results = evaluate_with({"offline.routes.dist_60.retailer_price": 55})
        self.assertIn(("error", "NEGATIVE_DISTRIBUTOR_MARGIN", "dist_60"), {(f.severity, f.code, f.ref) for f in results.findings})

    def test_planning_range_breach(self):
        results = evaluate_with({"product.planning_cost_max": 49})
        self.assertIn("PLANNING_COST_OUT_OF_RANGE", {f.code for f in results.findings})

    def test_no_targets_means_no_target_findings(self):
        raw = evaluate_with().config.raw
        del raw["targets"]
        results = evaluate_with(raw=raw)
        self.assertEqual({f.code for f in results.findings}, {"LADDER_DOMINATED", "SCENARIO_COST_ABOVE_PLANNING"})


class SensitivityTest(unittest.TestCase):
    def test_overlays_rerun_the_model(self):
        sens = {s.id: s for s in run_sensitivities(load_config(EXAMPLE))}
        self.assertAlmostEqual(by_id(sens["gst18"].results.offers, "trio").contribution, 29.428)
        self.assertAlmostEqual(by_id(sens["cac80"].results.offers, "trio").contribution, 6.6)
        self.assertAlmostEqual(by_id(sens["landed_plus10"].results.routes, "direct_70").contribution, 16)


class MetricsTest(unittest.TestCase):
    def test_flat_metrics(self):
        results = evaluate(load_config(EXAMPLE))
        m = metrics(results)
        self.assertAlmostEqual(m["online.web.trio.contribution"], 46.6)
        self.assertEqual(m["ladder.web.full.twelve.dominated"], 1.0)
        self.assertNotIn("routes.direct_70.distributor_margin", m)
        self.assertIsNone(metrics(results, include_none=True)["routes.direct_70.distributor_margin"])


if __name__ == "__main__":
    unittest.main()
