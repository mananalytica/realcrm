const express = require("express");
const db = require("../db");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [pipelineValue] = await db.all(`
      SELECT COALESCE(SUM(p.asking_price), 0) AS value
      FROM deals d
      LEFT JOIN properties p ON p.id = d.property_id
      WHERE d.stage NOT IN ('closed_won', 'closed_lost')
    `);

    const [newLeadsToday] = await db.all(`
      SELECT COUNT(*) AS count FROM leads WHERE CAST(created_at AS DATE) = current_date
    `);

    const [siteVisitsScheduled] = await db.all(`
      SELECT COUNT(*) AS count FROM deals WHERE stage = 'site_visit_scheduled'
    `);

    const [commissionsThisMonth] = await db.all(`
      SELECT COALESCE(SUM(amount), 0) AS value FROM financials
      WHERE entry_type = 'income' AND category = 'commission'
      AND date_trunc('month', entry_date) = date_trunc('month', current_date)
    `);

    const [tasksDue] = await db.all(`
      SELECT COUNT(*) AS count FROM tasks WHERE status IN ('pending', 'in_progress') AND due_date <= current_date + INTERVAL 3 DAY
    `);

    const recentLeads = await db.all(`
      SELECT l.*, c.name AS contact_name, c.phone AS contact_phone
      FROM leads l LEFT JOIN contacts c ON c.id = l.contact_id
      ORDER BY l.created_at DESC LIMIT 5
    `);

    const upcomingSiteVisits = await db.all(`
      SELECT t.*, COALESCE(ct.name, dbuyer.name) AS contact_name
      FROM tasks t
      LEFT JOIN contacts ct ON ct.id = t.related_id AND t.related_type = 'contact'
      LEFT JOIN deals d ON d.id = t.related_id AND t.related_type = 'deal'
      LEFT JOIN contacts dbuyer ON dbuyer.id = d.buyer_contact_id
      WHERE LOWER(t.title) LIKE '%site visit%' AND t.status IN ('pending', 'in_progress')
      ORDER BY t.due_date ASC LIMIT 5
    `);

    const dealsByStage = await db.all(`
      SELECT stage, COUNT(*) AS count FROM deals GROUP BY stage
    `);

    res.json({
      pipelineValue: pipelineValue.value,
      newLeadsToday: Number(newLeadsToday.count),
      siteVisitsScheduled: Number(siteVisitsScheduled.count),
      commissionsThisMonth: commissionsThisMonth.value,
      tasksDue: Number(tasksDue.count),
      recentLeads,
      upcomingSiteVisits,
      dealsByStage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
