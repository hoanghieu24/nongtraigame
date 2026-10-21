// ============================================================================
// KitchenLogic.js — Modular Game Logic Architecture for "Ready, Set, Cook!"
// Implements:
//   1. PlayerController  (Context-aware Interact & Hold State Machine)
//   2. StationLogic      (Crates, 3s Chopping Board, Plating, Service, 2s Sink)
//   3. CrisisManager     (5s Cook -> 5s Perfect Window -> FIRE! -> 3s Extinguisher -> Burnt Trash)
//   4. DifficultyDirector (180s Match Timer: Phase 1 Easy -> Phase 2 Rush Hour -> Phase 3 Level Up)
// ============================================================================

export const KITCHEN_TIMINGS = {
  MATCH_SECONDS: 180.0,       // 180s total match duration
  CHOP_SECONDS: 3.0,          // 3.0s hold to chop raw ingredient on Chopping Board
  WASH_SECONDS: 2.0,          // 2.0s hold to wash Dirty Plate in Sink
  COOK_SECONDS: 5.0,          // 5.0s countdown to cook food on Stove/Oven
  SAFE_WINDOW_SECONDS: 5.0,   // 5.0s Perfect State window before FIRE! triggers
  EXTINGUISH_SECONDS: 3.0,    // 3.0s hold with Fire Extinguisher to put out stove fire
  POUR_SECONDS: 2.5,          // 2.5s to pour Bubble Milk Tea
  MAX_PLATES: 4,              // 4-plate circulation pool
};

export const KITCHEN_RECIPES = {
  tomato_salad: {
    id: 'tomato_salad',
    name: 'Salad Cà Chua Tươi',
    phase: 1,
    ingredients: ['tomato_cut'],
    requiresBaking: false,
    price: 120,
  },
  soda: {
    id: 'soda',
    name: 'Trà Sữa Trân Châu',
    phase: 1,
    ingredients: ['soda'],
    requiresBaking: false,
    price: 115,
  },
  caprese: {
    id: 'caprese',
    name: 'Salad Caprese',
    phase: 3,
    ingredients: ['tomato_cut', 'mozz_cut'],
    requiresBaking: false,
    price: 145,
  },
  pizza: {
    id: 'pizza',
    name: 'Pizza Đút Lò',
    phase: 3,
    ingredients: ['dough', 'tomato_cut', 'mozz_cut'],
    requiresBaking: true,
    price: 195,
  },
};

// ============================================================================
// 1. PlayerController — Context-Aware Interaction & Hold Action State Machine
// ============================================================================
export class PlayerController {
  /**
   * @param {object} host - Reference to ReadySetCook2D scene / game state
   */
  constructor(host) {
    this.host = host;
    this.holdState = 'EMPTY'; // 'EMPTY' | 'RAW_ITEM' | 'CHOPPED_ITEM' | 'CLEAN_PLATE' | 'DIRTY_PLATE' | 'EXTINGUISHER' | 'BURNT_FOOD'
    this.activeHoldAction = null; // { type: 'CHOP' | 'WASH' | 'EXTINGUISH', stationId, progress, duration }
  }

  /**
   * Synchronize high-level state label from chef.hold object
   */
  syncState(chef) {
    const h = chef?.hold;
    if (!h) {
      this.holdState = 'EMPTY';
    } else if (h.kind === 'extinguisher') {
      this.holdState = 'EXTINGUISHER';
    } else if (h.kind === 'burnt_food') {
      this.holdState = 'BURNT_FOOD';
    } else if (h.kind === 'dirty') {
      this.holdState = 'DIRTY_PLATE';
    } else if (h.kind === 'raw') {
      this.holdState = 'RAW_ITEM';
    } else if (h.kind === 'dish' || h.kind === 'raw_pizza' || h.hasPlate) {
      this.holdState = 'CLEAN_PLATE';
    } else {
      this.holdState = 'CHOPPED_ITEM';
    }
    return this.holdState;
  }

  /**
   * Single context-aware "Interact" trigger based on what the player is holding and facing
   */
  interact(chef, station, table) {
    this.syncState(chef);

    // Priority 0: Customer Table interaction (Take Order / Serve Dish / Pick up Dirty Plate)
    if (table) {
      return this.host.stationLogic.handleTableInteract(chef, table);
    }
    if (!station) return false;

    // Priority 1: Trash Can — Error Handling & Burnt Food Disposal
    if (station.kind === 'trash') {
      return this.host.stationLogic.handleTrashInteract(chef, station);
    }

    // Priority 2: Fire Extinguisher Station — Pick up or return extinguisher
    if (station.kind === 'extinguisher') {
      return this.host.crisisManager.handleExtinguisherStation(chef, station);
    }

    // Priority 3: If holding Burnt Food, player MUST throw it in the Trash Can first!
    if (chef.hold?.kind === 'burnt_food') {
      this.host.addFloat?.(
        station.x,
        station.y - 28,
        '🗑️ Hãy vứt Đồ Cháy Đen vào Thùng Rác trước!',
        '#ff5252'
      );
      this.host.g?.audio?.sfx?.('fail');
      return false;
    }

    // Priority 4: If holding Fire Extinguisher, interact with burning oven or put extinguisher back
    if (chef.hold?.kind === 'extinguisher') {
      if (station.kind === 'oven') {
        return this.host.crisisManager.startExtinguishing(chef, station);
      }
      // Allow dropping extinguisher back if interacting with non-burning station
      chef.hold = chef.hold.prevHold || null;
      this.host.addFloat?.(chef.x, chef.y - 30, '🧯 Đã cất Bình Chữa Cháy về giá treo', '#80deea');
      this.syncState(chef);
    }

    // Delegate station-specific logic to StationLogic & CrisisManager
    switch (station.kind) {
      case 'crate':
      case 'dough':
        return this.host.stationLogic.handleCrateInteract(chef, station);
      case 'board':
        return this.host.stationLogic.handleBoardInteract(chef, station);
      case 'plate':
        return this.host.stationLogic.handlePlateInteract(chef, station);
      case 'sink':
      case 'rack':
        return this.host.stationLogic.handleSinkInteract(chef, station);
      case 'oven':
        return this.host.crisisManager.handleOvenInteract(chef, station);
      case 'drink':
        return this.host.stationLogic.handleDrinkInteract(chef, station);
      default:
        return false;
    }
  }

  /**
   * Update continuous hold-to-interact actions (3s Chopping, 2s Washing, 3s Fire Extinguishing)
   */
  updateHoldActions(chef, dt, isNearStationFn) {
    this.syncState(chef);
    this.host.stationLogic.updateChoppingBoards(chef, dt, isNearStationFn);
    this.host.stationLogic.updateSinkWashing(chef, dt, isNearStationFn);
    this.host.crisisManager.updateOvensAndFires(chef, dt, isNearStationFn);
  }

  // Shared equipment advances once per simulation frame, regardless of chef count.
  updateKitchen(chefs, dt, isNearStationFn) {
    this.host.stationLogic.updateChoppingBoards(chefs, dt, isNearStationFn);
    this.host.stationLogic.updateSinkWashing(chefs, dt, isNearStationFn);
    this.host.crisisManager.updateOvensAndFires(chefs, dt, isNearStationFn);
  }
}

// ============================================================================
// 2. StationLogic — Crates, 3s Chopping Board, Plating, Service & 2s Sink Loop
// ============================================================================
export class StationLogic {
  constructor(host) {
    this.host = host;
  }

  /**
   * Take Ingredient: Facing an Ingredient Crate with empty hands -> Spawn raw item
   */
  handleCrateInteract(chef, station) {
    const dir = this.host.difficultyDirector;
    const cutId = station.ing === 'tomato' ? 'tomato_cut' : station.ing === 'mozzarella' ? 'mozz_cut' : 'dough';
    if (chef.hold?.items?.includes(cutId)) return false;

    // Check if Cheese Spawner is locked before Phase 3
    if (station.ing === 'mozzarella' && dir && !dir.cheeseSpawnerUnlocked) {
      this.host.addFloat?.(
        station.x + 20,
        station.y - 28,
        '🔒 Phô mai mở sau 120 giây hoặc khi đạt 650 xu.',
        '#ffca28'
      );
      this.host.g?.audio?.sfx?.('fail');
      return false;
    }

    // Check if Dough is locked before Phase 3
    if (station.kind === 'dough' && dir && !dir.bakingOvenUnlocked) {
      this.host.addFloat?.(
        station.x,
        station.y - 28,
        '🔒 Đế pizza mở sau 120 giây hoặc khi đạt 650 xu.',
        '#ffca28'
      );
      this.host.g?.audio?.sfx?.('fail');
      return false;
    }

    if (chef.hold?.kind === 'dirty' || chef.hold?.kind === 'raw_pizza' || chef.hold?.kind === 'burnt_food') {
      return false;
    }

    if (station.kind === 'dough') {
      if (this.host.tryAddHeldItem(chef, 'dough')) {
        this.host.g?.audio?.sfx?.('pop');
        if (chef.hold?.kind !== 'raw_pizza') {
          this.host.addFloat?.(station.x, station.y - 25, '🫓 Đã lấy Đế Bánh Pizza!', '#ffe082');
        }
        return true;
      }
      if (!chef.hold) {
        chef.hold = { kind: 'item', id: 'dough', items: ['dough'], hasPlate: false };
        this.host.g?.audio?.sfx?.('pop');
        this.host.addFloat?.(station.x, station.y - 25, '🫓 Đã lấy Đế Bánh Pizza!', '#ffe082');
        return true;
      }
      return false;
    }

    // Raw Tomato or Raw Mozzarella Crate
    if (!chef.hold || chef.hold.kind === 'item' || (chef.hold.kind === 'dish' && chef.hold.dish === 'tomato_salad')) {
      const prev = chef.hold?.items
        ? [...chef.hold.items]
        : chef.hold?.prevItems
          ? [...chef.hold.prevItems]
          : [];
      chef.hold = {
        kind: 'raw',
        id: station.ing,
        prevItems: prev,
        hasPlate: !!chef.hold?.hasPlate,
      };
      this.host.g?.audio?.sfx?.('pop');
      this.host.addFloat?.(
        station.x,
        station.y - 24,
        station.ing === 'tomato'
          ? `🍅 Cà chua tươi -> Đặt lên Thớt cắt (${KITCHEN_TIMINGS.CHOP_SECONDS}s)!`
          : `🧀 Phô mai tươi -> Đặt lên Thớt cắt (${KITCHEN_TIMINGS.CHOP_SECONDS}s)!`,
        '#ffffff'
      );
      return true;
    }

    this.host.addFloat?.(
      station.x,
      station.y - 24,
      '💡 Tay đang bận! Hãy đặt đồ lên Thớt/Bát hoặc bỏ vào Thùng Rác 🗑️!',
      '#ffe082'
    );
    return false;
  }

  /**
   * Process Ingredient:
   * - Holding raw item -> Place on Chopping Board
   * - Empty hands + occupied board -> Hold 3.0s to chop into "Chopped Tomato" / "Chopped Cheese"
   */
  handleBoardInteract(chef, station) {
    const b = this.host.boards[station.idx];
    if (!b) return false;

    // 1. Pick up already chopped ingredient
    if (b.ready) {
      const cutId = b.ing === 'tomato' ? 'tomato_cut' : 'mozz_cut';
      if (this.host.tryAddHeldItem(chef, cutId)) {
        b.ing = null;
        b.prog = 0;
        b.ready = false;
        this.host.g?.audio?.sfx?.('pop');
        return true;
      }
    }

    // 2. Place raw ingredient onto empty chopping board
    if (chef.hold?.kind === 'raw' && !b.ing) {
      const rawId = chef.hold.id;
      const prev = chef.hold.prevItems || [];
      const hadPlate = !!chef.hold.hasPlate;
      chef.hold = prev.length
        ? { kind: 'item', id: prev[prev.length - 1], items: prev, hasPlate: hadPlate }
        : null;
      b.ing = rawId;
      b.prog = 0;
      b.ready = false;
      chef.chopT = 0.35;
      this.host.spawnParticles?.(station.x, station.y, 'chop', 5);
      this.host.g?.audio?.sfx?.('swish');
      this.host.addFloat?.(
        station.x - 30,
        station.y - 30,
        rawId === 'tomato'
          ? `🔪 Đã đặt Cà Chua -> Giữ ${KITCHEN_TIMINGS.CHOP_SECONDS}s để thái!`
          : `🔪 Đã đặt Phô Mai -> Giữ ${KITCHEN_TIMINGS.CHOP_SECONDS}s để thái!`,
        '#80deea'
      );
      return true;
    }

    // 3. Continue chopping occupied board (3.0s progress bar)
    if (b.ing && !b.ready) {
      chef.chopT = 0.35;
      const left = Math.max(0.1, (1 - b.prog) * KITCHEN_TIMINGS.CHOP_SECONDS).toFixed(1);
      this.host.addFloat?.(station.x - 30, station.y - 30, `🔪 Đang thái... còn ${left}s!`, '#4fc3f7');
      return true;
    }

    return false;
  }

  /**
   * Update 3.0-second Chopping Progress Bar when chef stands at/holds near an occupied board
   */
  updateChoppingBoards(chef, dt, isNearStationFn) {
    const chefs = Array.isArray(chef) ? chef : [chef];
    for (let i = 0; i < this.host.boards.length; i++) {
      const b = this.host.boards[i];
      const st = this.host.getStation?.('board' + i);
      if (!b || !st || !b.ing || b.ready) continue;

      // Player must have empty hands (or combinable item) and stand near the board
      const worker = chefs.find((c) => c && (!c.hold || c.hold.kind === 'item' || (c.hold.kind === 'dish' && c.hold.dish === 'tomato_salad')) && isNearStationFn(c, st));
      if (worker) {
        const chef = worker;
        chef.chopT = Math.max(chef.chopT || 0, 0.2);
        b.prog = Math.min(1, b.prog + dt / KITCHEN_TIMINGS.CHOP_SECONDS);
        if (Math.random() < dt * 8) {
          this.host.spawnParticles?.(st.x, st.y, 'chop', 2);
        }
        if (b.prog >= 1) {
          b.ready = true;
          this.host.g?.audio?.sfx?.('ding');
          const cutId = b.ing === 'tomato' ? 'tomato_cut' : 'mozz_cut';
          if (this.host.tryAddHeldItem(chef, cutId)) {
            b.ing = null;
            b.prog = 0;
            b.ready = false;
            this.host.addFloat?.(
              st.x - 30,
              st.y - 30,
              cutId === 'tomato_cut'
                ? '🔪 Đã thái xong Cà Chua (Chopped Tomato)!'
                : '🔪 Đã thái xong Phô Mai (Chopped Cheese)!',
              '#69f0ae'
            );
          }
        }
      }
    }
  }

  /**
   * Wrong Item / Error Handling:
   * Walking to the Trash Can and pressing "Interact" deletes the item from the player's hands,
   * resetting to an empty hand state (and preserving the 4-plate pool).
   */
  handleTrashInteract(chef, station) {
    if (!chef.hold) {
      this.host.addFloat?.(station.x + 25, station.y - 20, '🗑️ Tay đang trống!', '#cfd8dc');
      return false;
    }
    if (chef.hold.kind === 'dirty') {
      this.host.addFloat?.(station.x + 35, station.y - 20, '🍽️ Bát bẩn không vứt rác! Hãy đưa vô Bồn Rửa!', '#ffca28');
      return false;
    }
    if (chef.hold.kind === 'extinguisher') {
      chef.hold = chef.hold.prevHold || null;
      this.host.addFloat?.(station.x + 25, station.y - 20, '🧯 Đã cất Bình Chữa Cháy!', '#80deea');
      return true;
    }

    const wasBurnt = chef.hold.kind === 'burnt_food';
    if (chef.hold.hasPlate) {
      // Return plate to sink so the 4-plate pool is never permanently lost
      this.host.sink.dirtyCount = (this.host.sink.dirtyCount || 0) + 1;
    }
    chef.hold = null;
    this.host.g?.audio?.sfx?.('swish');
    this.host.spawnParticles?.(station.x, station.y, 'steam', 5);
    this.host.addFloat?.(
      station.x + 30,
      station.y - 22,
      wasBurnt
        ? '🗑️ Đã vứt đồ cháy đen vào Thùng Rác! Lò đã sẵn sàng!'
        : '🗑️ Đã huỷ nguyên liệu cầm nhầm -> Tay trống!',
      '#69f0ae'
    );
    return true;
  }

  /**
   * Serving & Cleaning Loop:
   * - Combine prepared/cooked ingredients onto a Clean Plate
   * - Deliver to Customer Table / Service Counter -> Gain points -> Spawns Dirty Plate
   * - Place Dirty Plate in Sink & hold 2.0s to convert back into Clean Plate
   */
  handlePlateInteract(chef, station) {
    const p = this.host.plates[station.idx];
    if (!p) return false;
    this.host.refillCounterPlates?.();

    if (!p.hasPlate && p.items.length === 0 && !p.dish) {
      this.host.addFloat?.(
        station.x,
        station.y - 26,
        '🍽️ Hết sạch 4 bát! Hãy thu bát bẩn đưa vô Bồn Rửa (2.0s)!',
        '#ff5252'
      );
      this.host.g?.audio?.sfx?.('fail');
      return false;
    }

    // Place chopped/prepared ingredients onto the clean plate
    if (
      chef.hold?.kind === 'item' ||
      (chef.hold?.kind === 'dish' && (chef.hold.dish === 'tomato_salad' || chef.hold.dish === 'caprese'))
    ) {
      const heldList = chef.hold.items || [chef.hold.id];
      if (!p.hasPlate || heldList.some((it) => !['tomato_cut', 'mozz_cut', 'dough'].includes(it))) return false;
      let added = false;
      for (const it of heldList) {
        if (it && !p.items.includes(it)) {
          p.items.push(it);
          added = true;
        }
      }
      if (added) {
        if (chef.hold.hasPlate) this.host.restoreOneCleanPlate?.();
        chef.hold = null;
        this.host.checkPlateRecipe?.(p);
        this.host.g?.audio?.sfx?.('pop');
        if (p.dish === 'raw_pizza') {
          this.host.addFloat?.(
            station.x,
            station.y - 25,
            `🍕 Đã ghép đủ Pizza sống -> Đem đút Lò Nướng (${KITCHEN_TIMINGS.COOK_SECONDS}s)!`,
            '#ffe082'
          );
        } else if (p.dish === 'caprese') {
          this.host.addFloat?.(station.x, station.y - 25, '🥗 Salad Caprese đã sẵn sàng trên bát!', '#a8ff8e');
        } else if (p.dish === 'tomato_salad') {
          this.host.addFloat?.(station.x, station.y - 25, '🍅 Salad Cà Chua đã sẵn sàng trên bát!', '#a8ff8e');
        }
        return true;
      }
    }

    // Pick up completed Salad (Tomato Salad or Caprese) on a Clean Plate to serve
    if ((p.dish === 'caprese' || p.dish === 'tomato_salad') && !chef.hold) {
      const servedDish = p.dish;
      p.hasPlate = false;
      chef.hold = { kind: 'dish', dish: servedDish, items: [...p.items], hasPlate: true };
      p.items = [];
      p.dish = null;
      this.host.refillCounterPlates?.();
      this.host.g?.audio?.sfx?.('pop');
      this.host.addFloat?.(
        station.x,
        station.y - 25,
        `🍽️ Bưng ${KITCHEN_RECIPES[servedDish]?.name || 'món ăn'} đi phục vụ! (Còn ${this.host.getTotalCleanPlates()}/${KITCHEN_TIMINGS.MAX_PLATES} bát sạch)`,
        '#a8ff8e'
      );
      return true;
    }

    // Pick up Raw Pizza to put in the Baking Oven
    if (p.dish === 'raw_pizza' && !chef.hold) {
      chef.hold = { kind: 'raw_pizza', items: [...p.items], hasPlate: false };
      p.items = [];
      p.dish = null;
      this.host.g?.audio?.sfx?.('pop');
      this.host.addFloat?.(
        station.x,
        station.y - 25,
        `🍕 Đem Pizza sống vào Lò Gạch nung ${KITCHEN_TIMINGS.COOK_SECONDS}s!`,
        '#ffe082'
      );
      return true;
    }

    // Pick up partial items from plate
    if (p.items.length > 0 && !chef.hold) {
      // Transfer the existing plate with its ingredients; never borrow another plate.
      chef.hold = { kind: 'item', id: p.items.at(-1), items: [...p.items], hasPlate: true };
      p.hasPlate = false;
      p.items = [];
      p.dish = null;
      this.host.refillCounterPlates?.();
      this.host.g?.audio?.sfx?.('pop');
      return true;
    }

    return false;
  }

  /**
   * Sink interaction: Place Dirty Plate into Sink and hold for 2.0 seconds to convert back to Clean Plate
   */
  handleSinkInteract(chef, station) {
    if (chef.hold?.kind === 'dirty') {
      const n = chef.hold.count || 1;
      this.host.sink.dirtyCount += n;
      chef.hold = null;
      this.host.spawnParticles?.(station.x, station.y, 'bubble', 8);
      this.host.g?.audio?.sfx?.('water');
      this.host.addFloat?.(
        station.x + 35,
        station.y - 22,
        `🍽️ Đã đặt ${n} bát bẩn vào Bồn Rửa -> Đứng giữ ${KITCHEN_TIMINGS.WASH_SECONDS}s để rửa sạch!`,
        '#4dd0e1'
      );
      return true;
    }
    if (this.host.sink.dirtyCount > 0) {
      const left = Math.max(0.1, (1 - this.host.sink.prog) * KITCHEN_TIMINGS.WASH_SECONDS).toFixed(1);
      this.host.addFloat?.(station.x + 35, station.y - 22, `🫧 Đang rửa bát... còn ${left}s!`, '#80deea');
      return true;
    }
    return false;
  }

  /**
   * Update 2.0-second Washing Progress Bar when player stands at the Sink
   */
  updateSinkWashing(chef, dt, isNearStationFn) {
    const chefs = Array.isArray(chef) ? chef : [chef];
    if (this.host.sink.dirtyCount <= 0) {
      this.host.sink.prog = 0;
      return;
    }
    const sinkSt = this.host.getStation?.('sink');
    const rackSt = this.host.getStation?.('dirtyRack');
    const worker = chefs.find((c) => c && (!c.hold || c.hold.kind === 'dirty' || c.hold.kind === 'item') && ((sinkSt && isNearStationFn(c, sinkSt)) || (rackSt && isNearStationFn(c, rackSt))));
    if (worker) {
      const chef = worker;
      if (chef.hold?.kind === 'dirty') {
        this.host.sink.dirtyCount += chef.hold.count || 1;
        chef.hold = null;
      }
      this.host.sink.prog = Math.min(1, this.host.sink.prog + dt / KITCHEN_TIMINGS.WASH_SECONDS);
      if (Math.random() < dt * 9) {
        this.host.spawnParticles?.(sinkSt.x + 8, sinkSt.y + 6, 'bubble', 2);
      }
      if (this.host.sink.prog >= 1) {
        this.host.sink.prog = 0;
        this.host.sink.dirtyCount--;
        this.host.restoreOneCleanPlate?.();
        this.host.g?.audio?.sfx?.('pop');
        if (rackSt) this.host.spawnParticles?.(rackSt.x, rackSt.y, 'star', 5);
        this.host.rewardCoins?.(
          25,
          sinkSt.x + 30,
          sinkSt.y - 24,
          `🫧 Rửa xong Bát Sạch! (${this.host.getTotalCleanPlates()}/${KITCHEN_TIMINGS.MAX_PLATES} bát) +25 🪙`
        );
      }
    }
  }

  /**
   * Bubble Milk Tea dispenser interaction
   */
  handleDrinkInteract(chef, station) {
    const dm = this.host.drinkMachine;
    if (dm.state === 'ready' && !chef.hold) {
      dm.state = 'idle';
      dm.prog = 0;
      dm.reservedPlate = false;
      chef.hold = { kind: 'dish', dish: 'soda', hasPlate: true };
      this.host.spawnParticles?.(station.x, station.y, 'bubble', 8);
      this.host.g?.audio?.sfx?.('pop');
      this.host.addFloat?.(station.x - 50, station.y - 24, '🧋 Trà Sữa Trân Châu đã xong -> Bưng ra bàn!', '#ffd54f');
      return true;
    }
    if (dm.state === 'idle' && !chef.hold) {
      if (!this.host.consumeOneCleanPlate?.()) {
        this.host.addFloat?.(
          station.x - 60,
          station.y - 24,
          '🍽️ Đã dùng hết 4 bát/khay! Hãy rửa bát bẩn ở Bồn Rửa trước!',
          '#ff5252'
        );
        this.host.g?.audio?.sfx?.('fail');
        return false;
      }
      dm.state = 'pouring';
      dm.prog = 0;
      dm.reservedPlate = true;
      this.host.spawnParticles?.(station.x, station.y, 'bubble', 6);
      this.host.g?.audio?.sfx?.('water');
      this.host.addFloat?.(
        station.x - 55,
        station.y - 28,
        `🧋 Đang rót Trà Sữa Trân Châu (${KITCHEN_TIMINGS.POUR_SECONDS}s)...`,
        '#ffcc80'
      );
      return true;
    }
    if (dm.state === 'pouring') {
      const left = Math.max(0.1, (1 - dm.prog) * KITCHEN_TIMINGS.POUR_SECONDS).toFixed(1);
      this.host.addFloat?.(station.x - 55, station.y - 28, `🧋 Đang rót Trà Sữa... còn ${left}s!`, '#ffe082');
      return true;
    }
    return false;
  }

  /**
   * Customer Table interaction:
   * 1. Take Order ('!')
   * 2. Pick up Dirty Plate -> bring to Sink
   * 3. Serve Clean Plate with Dish -> Gain points -> Spawns Dirty Plate
   */
  handleTableInteract(chef, tb) {
    // 1. Take order
    if (tb.guest && tb.guest.phase === 'wait_order') {
      tb.guest.phase = 'ordered';
      tb.guest.patience = tb.guest.maxPatience;
      this.host.g?.audio?.sfx?.('pop');
      const rName = KITCHEN_RECIPES[tb.guest.dish]?.name || 'Món ăn';
      this.host.rewardCoins?.(15, tb.x, tb.y - 30, `📝 Khách gọi ${rName}! (+15 🪙)`);
      return true;
    }

    // 2. Pick up Dirty Plate from table
    if (tb.dirty && (!chef.hold || chef.hold.kind === 'dirty')) {
      const picked = tb.dirtyCount || 1;
      tb.dirty = false;
      tb.dirtyCount = 0;
      const tip = tb.tip || 35;
      tb.tip = 0;
      const curCount = chef.hold?.kind === 'dirty' ? chef.hold.count || 1 : 0;
      chef.hold = { kind: 'dirty', count: curCount + picked };
      this.host.spawnParticles?.(tb.x, tb.y, 'star', 7);
      this.host.rewardCoins?.(
        tip,
        tb.x,
        tb.y - 20,
        `🍽️ Thu ${chef.hold.count} bát bẩn (+${tip} 🪙 Tip) -> Đem vô Bồn Rửa (${KITCHEN_TIMINGS.WASH_SECONDS}s)!`
      );
      return true;
    }

    // 3. Serve Dish on a Clean Plate
    if (tb.guest && (tb.guest.phase === 'ordered' || tb.guest.phase === 'wait_order') && chef.hold?.kind === 'dish') {
      const g = tb.guest;
      const exactMatch = chef.hold.dish === g.dish;
      if (!exactMatch) {
        const wantName = KITCHEN_RECIPES[g.dish]?.name || g.dish;
        this.host.addFloat?.(tb.x, tb.y - 34, `⚠️ Bàn này gọi ${wantName}!`, '#ffca28');
        this.host.g?.audio?.sfx?.('fail');
        return false;
      }

      if (!chef.hold.hasPlate) {
        if (!this.host.consumeOneCleanPlate?.()) {
          this.host.addFloat?.(tb.x, tb.y - 32, '🍽️ Hết sạch 4 bát! Hãy thu bát bẩn đưa vô Bồn Rửa!', '#ff5252');
          return false;
        }
      }

      const base = KITCHEN_RECIPES[chef.hold.dish]?.price || 130;
      const patBonus = g.patience / g.maxPatience > 0.65 ? 35 : 15;
      tb.eatingDish = chef.hold.dish;
      chef.hold = null;
      g.phase = 'eating';
      g.eatT = 3.2;

      this.host.served++;
      this.host.recordService?.(chef, tb.eatingDish);
      this.host.combo = exactMatch ? this.host.combo + 1 : 1;
      if (this.host.combo >= 3 && this.host.feverT <= 0) {
        this.host.feverT = 16;
        this.host.addFloat?.(640, 180, '🔥 FEVER MODE KÍCH HOẠT: ×2 TIỀN THƯỞNG & CHẠY NHANH!', '#ffeb3b');
        this.host.g?.audio?.sfx?.('levelup');
      }

      const feverMult = this.host.feverT > 0 ? 2 : 1;
      const vipMult = g.style?.vip ? 1.25 : 1;
      const pay = Math.round(
        (base + patBonus) *
          (exactMatch ? 1 : 0.85) *
          (1 + Math.min(1.2, (this.host.combo - 1) * 0.2)) *
          feverMult *
          vipMult
      );

      this.host.spawnParticles?.(tb.x, tb.y - 10, 'heart', 8);
      this.host.rewardCoins?.(
        pay,
        tb.x,
        tb.y - 28,
        `+${pay} 🪙${this.host.feverT > 0 ? ' 🔥FEVER ×2' : this.host.combo >= 2 ? ` 🔥COMBO ×${this.host.combo}` : ''}`
      );
      this.host.g?.audio?.sfx?.('coin');

      // Check score milestone for DifficultyDirector
      this.host.difficultyDirector?.checkScoreMilestones(this.host.earned);
      return true;
    }

    return false;
  }
}

// ============================================================================
// 3. CrisisManager — Kitchen Fire & Fire Extinguisher State Machine
// ============================================================================
export class CrisisManager {
  constructor(host) {
    this.host = host;
  }

  /**
   * Pick up or return the Fire Extinguisher tool at STATIONS.extinguisher
   */
  handleExtinguisherStation(chef, station) {
    if (chef.hold?.kind === 'extinguisher') {
      chef.hold = chef.hold.prevHold || null;
      this.host.g?.audio?.sfx?.('pop');
      this.host.addFloat?.(station.x, station.y - 26, '🧯 Đã treo lại Bình Chữa Cháy!', '#80deea');
      return true;
    }
    // Automatically drop/stow held item to grab the Fire Extinguisher in an emergency!
    const prevHold = chef.hold && chef.hold.kind !== 'extinguisher' ? chef.hold : null;
    chef.hold = { kind: 'extinguisher', prevHold };
    this.host.g?.audio?.sfx?.('pop');
    this.host.addFloat?.(
      station.x,
      station.y - 28,
      `🧯 Đã cầm Bình Chữa Cháy! Tới Lò đang cháy giữ ${KITCHEN_TIMINGS.EXTINGUISH_SECONDS}s để dập lửa!`,
      '#4dd0e1'
    );
    return true;
  }

  /**
   * Start or continue extinguishing a burning oven
   */
  startExtinguishing(chef, station) {
    const ov = this.host.ovens[station.idx];
    if (!ov) return false;
    if (ov.state !== 'burning') {
      this.host.addFloat?.(station.x, station.y + 42, '✨ Lò này không bị cháy!', '#80deea');
      return false;
    }
    const left = Math.max(0.1, (1 - (ov.extinguishProg || 0)) * KITCHEN_TIMINGS.EXTINGUISH_SECONDS).toFixed(1);
    this.host.addFloat?.(
      station.x,
      station.y + 42,
      `🧯 Đang phun bọt dập lửa... còn ${left}s!`,
      '#4dd0e1'
    );
    return true;
  }

  /**
   * Oven/Stove Interaction:
   * - 'burning': Requires Fire Extinguisher (3.0s hold). If player isn't holding it, guide/equip them!
   * - 'burnt': Player picks up burnt_food -> must throw into Trash Can before oven can be used again!
   * - 'ready': Perfect state (5.0s window) -> Take cooked Pizza onto a Clean Plate!
   * - 'idle': Place raw_pizza -> Start 5.0s Cooking countdown!
   */
  handleOvenInteract(chef, station) {
    const ov = this.host.ovens[station.idx];
    if (!ov) return false;
    const dir = this.host.difficultyDirector;

    // Check if Baking Oven is locked before Phase 3
    if (dir && !dir.bakingOvenUnlocked && ov.state === 'idle') {
      this.host.addFloat?.(
        station.x,
        station.y + 42,
        '🔒 Lò mở sau 120 giây hoặc khi đạt 650 xu.',
        '#ffca28'
      );
      this.host.g?.audio?.sfx?.('fail');
      return false;
    }

    // 1. Overcooked / Fire State ('burning')
    if (ov.state === 'burning') {
      if (chef.hold?.kind !== 'extinguisher') {
        // Direct player to pick up Fire Extinguisher (or auto-equip if standing right next to extinguisher)
        const extSt = this.host.getStation?.('extinguisher');
        if (extSt) {
          this.host.addFloat?.(
            station.x,
            station.y + 42,
            '🔥 LÒ ĐANG CHÁY! Hãy lấy Bình Chữa Cháy 🧯 bên cạnh lò và giữ 3s!',
            '#ff1744'
          );
          this.host.g?.audio?.sfx?.('alarm');
          this.host.setChefDestination?.(chef, extSt.standX, extSt.standY, extSt, null);
        }
        return false;
      }
      return this.startExtinguishing(chef, station);
    }

    // 2. Extinguished -> Burnt Food inside oven ('burnt')
    if (ov.state === 'burnt') {
      if (chef.hold) {
        this.host.addFloat?.(
          station.x,
          station.y + 42,
          '🗑️ Hãy để tay trống để lấy Bánh Cháy Đen đem vứt Thùng Rác!',
          '#ffca28'
        );
        return false;
      }
      ov.state = 'idle';
      ov.prog = 0;
      ov.burn = 0;
      ov.extinguishProg = 0;
      chef.hold = { kind: 'burnt_food', label: 'Pizza Cháy Đen' };
      this.host.g?.audio?.sfx?.('swish');
      this.host.addFloat?.(
        station.x,
        station.y + 42,
        '⚫ Đã lấy Bánh Cháy Đen -> Đem vứt vào Thùng Rác 🗑️ để dùng lại lò!',
        '#ff8a65'
      );
      return true;
    }

    // 3. Perfect State ('ready') -> Take Cooked Pizza onto a Clean Plate
    if (ov.state === 'ready' && !chef.hold) {
      if (!this.host.consumeOneCleanPlate?.()) {
        this.host.addFloat?.(
          station.x,
          station.y + 42,
          '🍽️ Hết sạch 4 bát! Hãy rửa bát ở Bồn Rửa để lấy Pizza chín ra!',
          '#ff5252'
        );
        this.host.g?.audio?.sfx?.('fail');
        return false;
      }
      ov.state = 'idle';
      ov.prog = 0;
      ov.burn = 0;
      ov.extinguishProg = 0;
      chef.hold = { kind: 'dish', dish: 'pizza', hasPlate: true };
      this.host.spawnParticles?.(station.x, station.y + 20, 'star', 8);
      this.host.g?.audio?.sfx?.('ding');
      this.host.addFloat?.(
        station.x,
        station.y + 42,
        `🍕 Đã lấy Pizza chín hoàn hảo! (${this.host.getTotalCleanPlates()}/${KITCHEN_TIMINGS.MAX_PLATES} bát sạch còn lại)`,
        '#ffe066'
      );
      return true;
    }

    // 4. Idle State -> Start 5.0-second Cooking Countdown
    if (ov.state === 'idle' && chef.hold) {
      const isRawPizza =
        chef.hold.kind === 'raw_pizza' ||
        (chef.hold.items &&
          chef.hold.items.includes('dough') &&
          chef.hold.items.includes('tomato_cut') &&
          chef.hold.items.includes('mozz_cut'));
      if (isRawPizza) {
        if (chef.hold.hasPlate) this.host.restoreOneCleanPlate?.();
        ov.state = 'baking';
        ov.prog = 0;
        ov.burn = 0;
        ov.extinguishProg = 0;
        chef.hold = null;
        this.host.spawnParticles?.(station.x, station.y + 18, 'ember', 8);
        this.host.g?.audio?.sfx?.('sizzle');
        this.host.addFloat?.(
          station.x,
          station.y + 42,
          `🔥 Đang nướng Pizza (${KITCHEN_TIMINGS.COOK_SECONDS}s)...`,
          '#ffb74d'
        );
        return true;
      } else {
        this.host.addFloat?.(
          station.x,
          station.y + 42,
          '💡 Cần ghép Đế Bánh + Cà Chua Thái + Phô Mai Thái để nướng Pizza!',
          '#ffe082'
        );
        return false;
      }
    }

    // 5. Currently cooking
    if (ov.state === 'baking') {
      const left = Math.max(0.1, (1 - ov.prog) * KITCHEN_TIMINGS.COOK_SECONDS).toFixed(1);
      this.host.addFloat?.(station.x, station.y + 42, `🔥 Đang nướng Pizza... còn ${left}s!`, '#ffb74d');
      return true;
    }

    return false;
  }

  /**
   * Per-frame update for all Ovens:
   * - Cooking Phase: 5.0s countdown ('baking' -> 'ready')
   * - Perfect State: 5.0s safe window ('ready' -> 'burning')
   * - Fire State: 'burning' with red smoke/fire particles; holding Fire Extinguisher for 3.0s -> 'burnt'
   */
  updateOvensAndFires(chef, dt, isNearStationFn) {
    const chefs = Array.isArray(chef) ? chef : [chef];
    for (let i = 0; i < this.host.ovens.length; i++) {
      const ov = this.host.ovens[i];
      const st = this.host.getStation?.('oven' + i);
      const ox = i === 0 ? 915 : 1072;
      const oy = 152;

      if (Math.random() < dt * 4) {
        this.host.spawnParticles?.(ox + (Math.random() - 0.5) * 32, oy, 'ember', 1);
      }

      if (ov.state === 'baking') {
        ov.prog = Math.min(1, ov.prog + dt / KITCHEN_TIMINGS.COOK_SECONDS);
        if (Math.random() < dt * 5) {
          this.host.spawnParticles?.(ox + (Math.random() - 0.5) * 24, oy - 10, 'steam', 1);
        }
        if (ov.prog >= 1) {
          ov.state = 'ready';
          ov.burn = 0;
          this.host.g?.audio?.sfx?.('ding');
          this.host.spawnParticles?.(ox, oy - 20, 'star', 6);
          this.host.addFloat?.(
            ox,
            oy + 24,
            `✨ Pizza đã chín! Lấy ra trong ${KITCHEN_TIMINGS.SAFE_WINDOW_SECONDS}s trước khi BỐC CHÁY!`,
            '#69f0ae'
          );
        }
      } else if (ov.state === 'ready') {
        // 5-second Perfect State safe window before triggering FIRE!
        ov.burn = Math.min(1, (ov.burn || 0) + dt / KITCHEN_TIMINGS.SAFE_WINDOW_SECONDS);
        if (ov.burn >= 1) {
          ov.state = 'burning';
          ov.extinguishProg = 0;
          this.host.g?.audio?.sfx?.('alarm');
          this.host.spawnParticles?.(ox, oy - 10, 'ember', 12);
          this.host.addFloat?.(
            ox,
            oy + 20,
            '🔥 CHÁY BẾP (FIRE!)! Lấy Bình Chữa Cháy 🧯 giữ 3s để dập lửa!',
            '#ff1744'
          );
        }
      } else if (ov.state === 'burning') {
        // Red fire & dark smoke particles
        if (Math.random() < dt * 10) {
          this.host.spawnParticles?.(ox + (Math.random() - 0.5) * 34, oy - 16, 'ember', 2);
          this.host.spawnParticles?.(ox + (Math.random() - 0.5) * 28, oy - 28, 'smoke', 1);
        }

        // Check if player is facing/near the burning oven while holding the Fire Extinguisher
        const worker = st && chefs.find((c) => c?.hold?.kind === 'extinguisher' && isNearStationFn(c, st));
        if (worker) {
          const chef = worker;
          ov.extinguishProg = Math.min(
            1,
            (ov.extinguishProg || 0) + dt / KITCHEN_TIMINGS.EXTINGUISH_SECONDS
          );
          if (Math.random() < dt * 14) {
            this.host.spawnParticles?.(ox + (Math.random() - 0.5) * 26, oy - 8, 'foam', 2);
          }
          if (ov.extinguishProg >= 1) {
            // Fire is out! Restore extinguisher and put burnt food in player's hands (or oven) for Trash disposal
            ov.prog = 0;
            ov.burn = 0;
            ov.extinguishProg = 0;
            this.host.spawnParticles?.(ox, oy - 12, 'steam', 12);
            this.host.g?.audio?.sfx?.('swish');

            // Preserve the 4-plate pool if chef grabbed the Fire Extinguisher while holding a plated dish or dirty plate
            const prevHold = chef.hold?.prevHold;
            if (prevHold) {
              if (prevHold.hasPlate) {
                this.host.restoreOneCleanPlate?.();
              } else if (prevHold.kind === 'dirty') {
                const count = Math.max(1, prevHold.count || 1);
                this.host.sink.dirtyCount = Math.min(
                  KITCHEN_TIMINGS.MAX_PLATES,
                  (this.host.sink.dirtyCount || 0) + count
                );
              }
            }

            // If another oven is also burning, keep extinguisher in hand and leave burnt food in this oven;
            // otherwise auto-hand burnt food to player so they can walk straight to the Trash Can!
            const otherOvenBurning = this.host.ovens.some((other, idx) => idx !== i && other.state === 'burning');
            if (otherOvenBurning) {
              chef.hold = { kind: 'extinguisher', prevHold: null };
              ov.state = 'burnt';
              this.host.addFloat?.(
                ox,
                oy + 38,
                '🧯 Đã dập lò này! Hãy dập tiếp lò bên cạnh rồi lấy Bánh Cháy vứt Thùng Rác 🗑️!',
                '#80deea'
              );
            } else {
              chef.hold = { kind: 'burnt_food', label: 'Pizza Cháy Đen' };
              ov.state = 'idle';
              this.host.addFloat?.(
                ox,
                oy + 38,
                '🧯 Đã dập tắt lửa! Hãy mang Bánh Cháy Đen trên tay vứt vào Thùng Rác 🗑️!',
                '#80deea'
              );
            }
          }
        }
      }
    }
  }
}

// ============================================================================
// 4. DifficultyDirector — Dynamic Rush Hour & Level Progression (180s Match)
// ============================================================================
export class DifficultyDirector {
  constructor(host) {
    this.host = host;
    this.reset();
  }

  reset() {
    this.matchDuration = KITCHEN_TIMINGS.MATCH_SECONDS; // 180s total
    this.elapsed = 0;
    this.shiftsCompleted = 0;
    this.phase = 1; // 1: Easy Mode (0-60s), 2: Rush Hour (61-120s), 3: Level Up & Menu Expansion (121-180s)
    this.orderSpawnInterval = 25.0; // Phase 1: 1 order every 25 seconds
    this.patienceDecayMultiplier = 1.0; // Phase 1: 1.0x normal patience decay
    this.unlockedRecipes = ['tomato_salad', 'soda'];
    this.cheeseSpawnerUnlocked = false;
    this.bakingOvenUnlocked = false;
    this.announcementBanner = {
      text: '👨‍🍳 CA BẾP BẮT ĐẦU • 3 PHÚT GIÀNH 3 SAO',
      subText: 'Chạm phiếu món để tìm bước tiếp theo • Thái → phục vụ → dọn → rửa',
      color: '#69f0ae',
      timer: 5.5,
    };
  }

  /**
   * Update match timer and check phase transitions (0-60s, 61-120s, 121-180s)
   */
  update(dt) {
    if (this.host.matchOver) return;
    this.elapsed += dt;
    if (this.elapsed >= this.matchDuration) {
      this.elapsed = this.matchDuration;
      if (this.shiftsCompleted === 0) {
        this.shiftsCompleted = 1;
        if (this.host.finishShift) this.host.finishShift();
        else {
          this.host.matchOver = true;
          this.host.rewardCoins?.(200, 640, 195, '🏆 Hoàn thành ca bếp +200 xu');
        }
      }
      return;
    }

    if (this.announcementBanner.timer > 0) {
      this.announcementBanner.timer = Math.max(0, this.announcementBanner.timer - dt);
    }

    if (this.phase === 1 && this.elapsed >= 60) {
      this.enterPhase2();
    } else if (this.phase === 2 && this.elapsed >= 120) {
      this.enterPhase3();
    }
  }

  /**
   * Allow score milestones to trigger Phase progression early if the player is doing great!
   */
  checkScoreMilestones(currentScore) {
    if (this.phase === 1 && currentScore >= 300) {
      this.enterPhase2(true);
    } else if (this.phase === 2 && currentScore >= 650) {
      this.enterPhase3(true);
    }
  }

  /**
   * Phase 2 (61s - 120s) — Rush Hour:
   * - Order spawn rate doubles (1 order every 12 seconds)
   * - Customer patience bars decrease 30% faster (1.3x)
   */
  enterPhase2(byScore = false) {
    if (this.phase >= 2) return;
    this.phase = 2;
    this.orderSpawnInterval = 12.0;
    this.patienceDecayMultiplier = 1.3;
    this.announcementBanner = {
      text: '⚡ GIỜ CAO ĐIỂM! KHÁCH ĐÔNG HƠN',
      subText: byScore
        ? 'Đạt 300 xu sớm! Khách mới mỗi 12 giây • Chia việc cùng nhau nhé!'
        : 'Khách mới mỗi 12 giây • Ưu tiên phiếu có thanh thời gian màu đỏ',
      color: '#ffca28',
      timer: 6.0,
    };
    this.host.g?.audio?.sfx?.('bell');
    this.host.addFloat?.(640, 190, '⚡ RUSH HOUR! Khách đông gấp đôi (12s/đơn)!', '#ffca28');
    // Reduce current spawn timer so player feels the Rush Hour immediately
    if (this.host.guestSpawnT > 4.0) {
      this.host.guestSpawnT = 3.5;
    }
  }

  /**
   * Phase 3 (121s - 180s) — Level Up & Menu Expansion:
   * - Trigger "LEVEL UP!" visual announcement
   * - Unlock new recipe on UI: "Pizza" (Dough + Cheese + Tomato) & "Salad Caprese"
   * - Activate "Cheese Spawner" crate
   * - Turn on "Baking Oven" stations
   * - Orders randomly alternate between simple Phase 1 dishes and complex Phase 3 dishes
   */
  enterPhase3(byScore = false) {
    if (this.phase >= 3) return;
    this.phase = 3;
    this.orderSpawnInterval = 12.0;
    this.patienceDecayMultiplier = 1.3;
    this.cheeseSpawnerUnlocked = true;
    this.bakingOvenUnlocked = true;
    this.unlockedRecipes = ['tomato_salad', 'soda', 'caprese', 'pizza'];

    this.announcementBanner = {
      text: '🎉 MỞ THỰC ĐƠN CAPRESE & PIZZA',
      subText: byScore
        ? 'Đạt 650 xu sớm! Phô mai, đế pizza và hai lò đã sẵn sàng.'
        : 'Pizza: đế + cà chua thái + phô mai thái → nướng 5 giây → phục vụ',
      color: '#ff6d00',
      timer: 7.5,
    };
    this.host.g?.audio?.sfx?.('levelup');
    this.host.spawnParticles?.(132, 640, 'star', 10);
    this.host.spawnParticles?.(915, 152, 'star', 10);
    this.host.spawnParticles?.(1072, 152, 'star', 10);
    this.host.addFloat?.(640, 185, '🎉 LEVEL UP! Đã mở Thùng Phô Mai 🧀 & Lò Nướng Pizza 🔥!', '#ffe066');
  }

  /**
   * Pick next customer order based on current Phase:
   * - Phase 1 & 2: Simple 1-ingredient dishes ('tomato_salad', 'soda')
   * - Phase 3: Randomly alternates between simple Phase 1 dishes and complex Phase 3 dishes ('pizza', 'caprese')
   */
  pickNextOrderDish() {
    if (this.phase < 3) {
      return Math.random() < 0.68 ? 'tomato_salad' : 'soda';
    }
    // Phase 3: Alternate between simple Phase 1 dishes and complex Phase 3 multi-ingredient dishes
    const roll = Math.random();
    if (roll < 0.45) return 'pizza';
    if (roll < 0.68) return 'caprese';
    if (roll < 0.86) return 'tomato_salad';
    return 'soda';
  }

  getRemainingSeconds() {
    return Math.max(0, this.matchDuration - this.elapsed);
  }
}

