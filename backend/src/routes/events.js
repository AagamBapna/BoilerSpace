const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Club = require('../models/Club');
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const { protect } = require('../middleware/auth'); // only protect now
const User = require('../models/User');
const { sendNotification } = require('../services/NotificationService');
const { protect } = require('../middleware/auth');
const { normalizeRecurrence, generateRecurringDates, isRecurringSeries, normalizeDateInput } = require('../utils/recurrence');

function parseDateOnly(value) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function getDayOfWeekFromDate(value) {
  const date = parseDateOnly(value);
  return date ? date.getUTCDay() : null;
}

function buildRecurrenceForSeries(recurrence, fallbackDate) {
  const normalized = normalizeRecurrence(recurrence || {});
  if (normalized.type === 'weekly' && normalized.dayOfWeek === null) {
    normalized.dayOfWeek = getDayOfWeekFromDate(fallbackDate);
  }
  return normalized;
}

function buildEventFromBase(baseDoc, overrides, date, recurrence, recurrenceGroupId) {
  return {
    title: overrides.title !== undefined ? String(overrides.title || '').trim() : String(baseDoc.title || '').trim(),
    description: overrides.description !== undefined ? String(overrides.description || '').trim() : String(baseDoc.description || '').trim(),
    date,
    time: overrides.time !== undefined ? String(overrides.time || '').trim() : String(baseDoc.time || '').trim(),
    location: overrides.location !== undefined ? String(overrides.location || '').trim() : String(baseDoc.location || '').trim(),
    clubId: baseDoc.clubId,
    recurrence: {
      type: recurrence.type,
      interval: recurrence.interval,
      dayOfWeek: recurrence.dayOfWeek,
      endDate: recurrence.endDate,
      recurrenceGroupId,
    },
  };
}

function normalizeEvent(eventDoc) {
  const doc = eventDoc.toObject ? eventDoc.toObject() : eventDoc;
  return {
    ...doc,
    id: doc._id.toString(),
    club: doc.clubId,
    clubId: doc.clubId?._id?.toString() || doc.clubId?.toString(),
    recurrence: doc.recurrence || { type: 'none', interval: 1, dayOfWeek: null, endDate: null, recurrenceGroupId: null },
  };
}

async function loadClubForEvent(eventId) {
  const event = await Event.findById(eventId);
  if (!event) return null;
  const club = await Club.findById(event.clubId);
  if (!club) return { event: null, club: null };
  return { event, club };
}

function ensureEventFields(body) {
  const { title, description, date, time, location, clubId } = body;
  if (!title || !title.trim()) {
    return { error: { error: 'Validation failed', fields: { title: 'Title is required' } } };
  }
  if (!description || !description.trim()) {
    return { error: { error: 'Validation failed', fields: { description: 'Description is required' } } };
  }
  if (!date || !String(date).trim()) {
    return { error: { error: 'Validation failed', fields: { date: 'Date is required' } } };
  }
  if (!time || !time.trim()) {
    return { error: { error: 'Validation failed', fields: { time: 'Time is required' } } };
  }
  if (!location || !location.trim()) {
    return { error: { error: 'Validation failed', fields: { location: 'Location is required' } } };
  }
  if (!clubId || !String(clubId).trim()) {
    return { error: { error: 'Validation failed', fields: { clubId: 'Club is required' } } };
  }
  return { ok: true };
}

function buildEventPayload(body, clubId, date, recurrence, recurrenceGroupId) {
  return {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    date,
    time: String(body.time || '').trim(),
    location: String(body.location || '').trim(),
    clubId,
    recurrence: {
      type: recurrence.type,
      interval: recurrence.interval,
      dayOfWeek: recurrence.dayOfWeek,
      endDate: recurrence.endDate,
      recurrenceGroupId,
    },
  };
}

async function populateEvents(events) {
  const docs = Array.isArray(events) ? events : [events];
  const populated = [];
  for (const event of docs) {
    // eslint-disable-next-line no-await-in-loop
    await event.populate({
      path: 'clubId',
      select: 'id name category contactInfo',
      populate: { path: 'organizerIds', select: 'id name email' },
    });
    populated.push(normalizeEvent(event));
  }
  return Array.isArray(events) ? populated : populated[0];
}

async function assertOrganizerAccess(req, club) {
  const organizerIds = Array.isArray(club.organizerIds) ? club.organizerIds.map(String) : [];
  return organizerIds.includes(String(req.user.id));
}

router.get('/', protect, async (req, res) => {
  try {
    const { clubId, fromDate, toDate, recurrenceGroupId } = req.query;
    const filter = {};
    if (clubId) filter.clubId = clubId;
    if (recurrenceGroupId) filter['recurrence.recurrenceGroupId'] = String(recurrenceGroupId);
    if (fromDate) filter.date = { ...filter.date, $gte: normalizeDateInput(fromDate) };
    if (toDate) filter.date = { ...filter.date, $lte: normalizeDateInput(toDate) };

    const events = await Event.find(filter)
      .populate({
        path: 'clubId',
        select: 'id name category contactInfo',
        populate: { path: 'organizerIds', select: 'id name email' },
      })
      .sort({ date: 1, time: 1 })
      .lean({ virtuals: true });

    return res.json(events.map((e) => ({
      ...e,
      id: e._id.toString(),
      club: e.clubId,
      clubId: e.clubId?._id?.toString(),
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate({
        path: 'clubId',
        select: 'id name category contactInfo',
        populate: { path: 'organizerIds', select: 'id name email' },
      });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    return res.json(normalizeEvent(event));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const validation = ensureEventFields(req.body);
    if (validation.error) return res.status(400).json(validation.error);

    const { title, description, date, time, location, clubId } = req.body;
    const normalizedDate = normalizeDateInput(date);

    if (!normalizedDate) {
      return res.status(400).json({ error: 'Validation failed', fields: { date: 'Date is required' } });
    }

    const recurrence = buildRecurrenceForSeries(req.body.recurrence || {}, normalizedDate);

    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: 'Club not found' });
    if (!(await assertOrganizerAccess(req, club))) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to create events for this club.' });
    }

    if (recurrence.type === 'weekly' && recurrence.dayOfWeek === null) {
      return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'Recurring events require a day of week' } });
    }

    if (recurrence.type !== 'none' && !recurrence.endDate) {
      return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'Recurring events require an end date' } });
    }
    if (recurrence.endDate && recurrence.endDate < normalizedDate) {
      return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'End date must be on or after the event date' } });
    }
    const dates = generateRecurringDates({ startDate: normalizedDate, recurrence });
    if (dates.length === 0) {
      return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'Recurring events require a valid start date and day of week' } });
    }
    const recurrenceGroupId = recurrence.type === 'none' ? null : new mongoose.Types.ObjectId().toString();
    const payloads = dates.map((eventDate) => buildEventPayload(req.body, club._id, eventDate, recurrence, recurrenceGroupId));
    const createdEvents = await Event.insertMany(payloads);
    const populated = await populateEvents(createdEvents);
    (async () => {
      try {
        const members = await User.find({ clubIds: club._id.toString(), _id: { $ne: req.user.id } });
        const anchorEvent = createdEvents[0]; 
        for (const member of members) {
          await sendNotification({
            userId: member._id,
            type: 'event',
            message: `New event "${anchorEvent.title}" created in ${club.name}.`,
            eventId: anchorEvent._id,
          });
        }
      } catch (err) {
        console.error('Failed to send notifications for new event:', err);
      }
    })();
    return res.status(201).json(dates.length === 1 ? populated[0] : populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const { event, club } = await loadClubForEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!club) return res.status(404).json({ error: 'Club not found' });
    if (!(await assertOrganizerAccess(req, club))) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to update events for this club.' });
    }

    const scope = String(req.query.scope || req.body.scope || 'single').toLowerCase();
    const targetGroupId = event.recurrence?.recurrenceGroupId;
    const isSeries = isRecurringSeries(event);
    const targetFilter = scope === 'all' && isSeries
      ? { clubId: event.clubId, 'recurrence.recurrenceGroupId': targetGroupId }
      : scope === 'future' && isSeries
        ? { clubId: event.clubId, 'recurrence.recurrenceGroupId': targetGroupId, date: { $gte: event.date } }
        : { _id: event._id };

    const updates = {};
    ['title', 'description', 'date', 'time', 'location'].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = String(req.body[field]).trim();
      }
    });

    if (updates.date !== undefined) {
      const normalizedPatchDate = normalizeDateInput(updates.date);
      if (!normalizedPatchDate) {
        return res.status(400).json({ error: 'Validation failed', fields: { date: 'Date is required' } });
      }
      updates.date = normalizedPatchDate;
    }

    if (req.body.recurrence) {
      const recurrence = buildRecurrenceForSeries(req.body.recurrence, updates.date || event.date);
      if (recurrence.type === 'weekly' && recurrence.dayOfWeek === null) {
        return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'Recurring events require a day of week' } });
      }
      if (recurrence.type !== 'none' && !recurrence.endDate) {
        return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'Recurring events require an end date' } });
      }
      updates.recurrence = {
        type: recurrence.type,
        interval: recurrence.interval,
        dayOfWeek: recurrence.dayOfWeek,
        endDate: recurrence.endDate,
        recurrenceGroupId: recurrence.type === 'none' ? null : targetGroupId || new mongoose.Types.ObjectId().toString(),
      };
    }

    if (scope === 'single' && isSeries) {
      delete updates.recurrence;
    }

    const eventsToUpdate = await Event.find(targetFilter);
    if (eventsToUpdate.length === 0) return res.status(404).json({ error: 'Event not found' });

    const shouldRebuildSeriesDates = scope !== 'single' && isSeries && (updates.date !== undefined || updates.recurrence !== undefined);

    if (shouldRebuildSeriesDates) {
      const sortedEvents = [...eventsToUpdate].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time || '').localeCompare(String(b.time || '')));
      const anchorDoc = scope === 'future' ? event : sortedEvents[0];
      const recurrence = buildRecurrenceForSeries(updates.recurrence || event.recurrence || {}, updates.date || anchorDoc.date);
      if (recurrence.type === 'weekly' && recurrence.dayOfWeek === null) {
        recurrence.dayOfWeek = getDayOfWeekFromDate(updates.date || anchorDoc.date);
      }

      const desiredDates = generateRecurringDates({
        startDate: updates.date || anchorDoc.date,
        recurrence,
        maxInstances: Math.max(sortedEvents.length + 24, 24),
      });

      if (desiredDates.length === 0) {
        return res.status(400).json({ error: 'Validation failed', fields: { recurrence: 'Recurring events require a valid start date and day of week' } });
      }

      const docsToSave = [];
      const docsToDelete = [];
      const docsToCreate = [];
      const baseDoc = sortedEvents[0].toObject();

      desiredDates.forEach((eventDate, index) => {
        if (index < sortedEvents.length) {
          const doc = sortedEvents[index];
          Object.assign(doc, updates);
          doc.date = eventDate;
          doc.recurrence = {
            ...(doc.recurrence || {}),
            ...(updates.recurrence || {}),
            type: recurrence.type,
            interval: recurrence.interval,
            dayOfWeek: recurrence.dayOfWeek,
            endDate: recurrence.endDate,
            recurrenceGroupId: recurrence.type === 'none' ? null : targetGroupId || doc.recurrence?.recurrenceGroupId || new mongoose.Types.ObjectId().toString(),
          };
          docsToSave.push(doc);
        } else {
          docsToCreate.push(buildEventFromBase(baseDoc, updates, eventDate, recurrence, targetGroupId || baseDoc.recurrence?.recurrenceGroupId || new mongoose.Types.ObjectId().toString()));
        }
      });

      if (sortedEvents.length > desiredDates.length) {
        docsToDelete.push(...sortedEvents.slice(desiredDates.length));
      }

      await Promise.all(docsToSave.map((doc) => doc.save()));

      if (docsToCreate.length > 0) {
        const inserted = await Event.insertMany(docsToCreate);
        await populateEvents(inserted);
      }

      if (docsToDelete.length > 0) {
        await Promise.all([
          Event.deleteMany({ _id: { $in: docsToDelete.map((doc) => doc._id) } }),
          Announcement.deleteMany({ eventId: { $in: docsToDelete.map((doc) => doc._id) } }),
        ]);
      }
    } else {
      await Promise.all(eventsToUpdate.map((doc) => {
        Object.assign(doc, updates);
        if (scope !== 'single' && isSeries) {
          doc.recurrence = {
            ...(doc.recurrence || {}),
            ...(updates.recurrence || {}),
          };
        }
        return doc.save();
      }));
    }

    const refreshed = await Event.find(targetFilter)
      .populate({
        path: 'clubId',
        select: 'id name category contactInfo',
        populate: { path: 'organizerIds', select: 'id name email' },
      })
      .sort({ date: 1, time: 1 });

    return res.json({
      updatedCount: refreshed.length,
      events: await populateEvents(refreshed),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { event, club } = await loadClubForEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!club) return res.status(404).json({ error: 'Club not found' });
    if (!(await assertOrganizerAccess(req, club))) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to delete events for this club.' });
    }

    const scope = String(req.query.scope || req.body?.scope || 'single').toLowerCase();
    const isSeries = isRecurringSeries(event);
    const targetGroupId = event.recurrence?.recurrenceGroupId;
    const targetFilter = scope === 'all' && isSeries
      ? { clubId: event.clubId, 'recurrence.recurrenceGroupId': targetGroupId }
      : scope === 'future' && isSeries
        ? { clubId: event.clubId, 'recurrence.recurrenceGroupId': targetGroupId, date: { $gte: event.date } }
        : { _id: event._id };

    const eventsToDelete = await Event.find(targetFilter).select('_id');
    const eventIds = eventsToDelete.map((doc) => doc._id);
    if (eventIds.length === 0) return res.status(404).json({ error: 'Event not found' });

    await Promise.all([
      Event.deleteMany({ _id: { $in: eventIds } }),
      Announcement.deleteMany({ eventId: { $in: eventIds } }),
    ]);

    return res.json({ success: true, deletedCount: eventIds.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;