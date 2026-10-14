import copy
import unittest

from helpers import EXAMPLE, example_raw
from unit_economics import ConfigError, apply_overlay, load_config, parse_config


class LoadTest(unittest.TestCase):
    def test_example_loads(self):
        cfg = load_config(EXAMPLE)
        self.assertEqual(len(cfg.routes), 3)
        self.assertEqual(len(cfg.online), 1)
        self.assertEqual([o.units for o in cfg.online[0].offers], [1, 3, 6, 12])
        self.assertEqual(len(cfg.scenarios), 2)
        self.assertEqual(len(cfg.sensitivities), 3)

    def test_inline_param_keeps_provenance(self):
        mrp = load_config(EXAMPLE).product.mrp
        self.assertEqual((mrp.value, mrp.status, mrp.source, mrp.path), (100.0, "assumption", "example", "product.mrp"))

    def test_item_level_status_applies_to_amount(self):
        freight = load_config(EXAMPLE).product.components[0].amount
        self.assertEqual((freight.status, freight.source), ("assumption", "example"))

    def test_defaults_are_registered_as_unspecified(self):
        raw = example_raw()
        del raw["product"]["gst_rate"]
        cfg = parse_config(raw)
        self.assertEqual(cfg.product.gst_rate.value, 0.0)
        self.assertEqual(cfg.product.gst_rate.status, "unspecified")
        self.assertIn("default", cfg.product.gst_rate.source)
        self.assertIn("product.gst_rate", [p.path for p in cfg.register])

    def test_every_numeric_input_is_in_the_register(self):
        cfg = load_config(EXAMPLE)
        paths = {p.path for p in cfg.register}
        self.assertIn("online.web.costs.payment.amount", paths)
        self.assertIn("offline.routes.dist_60.retailer_price", paths)
        self.assertIn("scenarios.month.mix[1].realization", paths)
        self.assertEqual(len(paths), len(cfg.register))

    def test_scheme_parsing(self):
        route = load_config(EXAMPLE).routes[2]
        self.assertEqual((route.scheme_buy, route.scheme_free, route.scheme), (10, 1, "10+1"))

    def test_without_price_cards_all_offers_form_one_card(self):
        raw = example_raw()
        del raw["online"][0]["price_cards"]
        cards = parse_config(raw).online[0].price_cards
        self.assertEqual([(c.id, len(c.offer_ids)) for c in cards], [("all", 4)])


class ValidationTest(unittest.TestCase):
    def assertRejected(self, mutate, fragment):
        raw = example_raw()
        mutate(raw)
        with self.assertRaises(ConfigError) as ctx:
            parse_config(raw)
        self.assertIn(fragment, str(ctx.exception))

    def test_missing_mrp(self):
        self.assertRejected(lambda r: r["product"].pop("mrp"), "product.mrp: required value is missing")

    def test_text_where_number_expected(self):
        self.assertRejected(lambda r: r["product"].__setitem__("landed_cost", "40"), "expected a number")

    def test_negative_price(self):
        self.assertRejected(lambda r: r["online"][0]["offers"][0].__setitem__("price", -1), "must be >=")

    def test_bad_basis(self):
        self.assertRejected(lambda r: r["online"][0]["costs"][0].__setitem__("basis", "per_box"), "basis: must be one of")

    def test_percentage_above_one(self):
        self.assertRejected(lambda r: r["online"][0]["costs"][2].__setitem__("amount", 2), "must be <= 1")

    def test_duplicate_ids(self):
        self.assertRejected(lambda r: r["online"][0]["offers"][1].__setitem__("id", "single"), "duplicate id 'single'")

    def test_mix_must_add_up(self):
        self.assertRejected(lambda r: r["scenarios"][0]["mix"][0].__setitem__("share", 0.6), "shares must add up to 1")

    def test_unknown_offer_on_card(self):
        self.assertRejected(lambda r: r["online"][0]["price_cards"][0]["offers"].append("nope"), "unknown offer id")

    def test_same_units_on_one_card(self):
        def mutate(r):
            r["online"][0]["offers"].append({"id": "single_b", "name": "Single B", "units": 1, "price": 97})
            r["online"][0]["price_cards"][0]["offers"].append("single_b")

        self.assertRejected(mutate, "same units")

    def test_bad_scheme(self):
        self.assertRejected(lambda r: r["offline"]["routes"][2].__setitem__("scheme", "ten plus one"), "scheme must look like")

    def test_retailer_price_on_direct_route(self):
        self.assertRejected(lambda r: r["offline"]["routes"][0].__setitem__("retailer_price", 80), "only applies to via = 'distributor'")

    def test_planning_range_order(self):
        self.assertRejected(lambda r: r["product"].__setitem__("planning_cost_min", 60), "greater than planning_cost_max")

    def test_unknown_status(self):
        self.assertRejected(lambda r: r["product"].__setitem__("mrp", {"value": 100, "status": "guess"}), "status must be one of")

    def test_whole_units(self):
        self.assertRejected(lambda r: r["online"][0]["offers"][0].__setitem__("units", 1.5), "whole number")


class OverlayTest(unittest.TestCase):
    def test_set_and_scale(self):
        raw = example_raw()
        before = copy.deepcopy(raw)
        out = apply_overlay(
            raw,
            {"online.web.costs.cac.amount": 80, "product.mrp": 120},
            {"product.landed_cost": 1.1},
        )
        self.assertEqual(raw, before, "overlays must not change the original")
        cfg = parse_config(out)
        self.assertEqual(cfg.online[0].costs[3].amount.value, 80)
        self.assertEqual(cfg.product.mrp.value, 120)
        self.assertEqual(cfg.product.mrp.status, "assumption", "setting a value keeps its provenance fields")
        self.assertAlmostEqual(cfg.product.landed_cost.value, 44.0)

    def test_set_creates_missing_leaf(self):
        raw = example_raw()
        del raw["product"]["gst_rate"]
        self.assertEqual(parse_config(apply_overlay(raw, {"product.gst_rate": 0.05})).product.gst_rate.value, 0.05)

    def test_bad_paths(self):
        raw = example_raw()
        with self.assertRaisesRegex(ConfigError, "no item with id 'nope'"):
            apply_overlay(raw, {"online.nope.costs.cac.amount": 1})
        with self.assertRaisesRegex(ConfigError, "cannot be scaled"):
            apply_overlay(raw, scale={"product.not_there": 2})


if __name__ == "__main__":
    unittest.main()
