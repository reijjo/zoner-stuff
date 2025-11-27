import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { ChangeStream, ChangeStreamInsertDocument, Document } from 'mongodb';
import { Model } from 'mongoose';
import { EVENT_STORE_CONNECTION } from 'src/core/core.constants';
import { Event, EventDocument } from './schemas/event.schema';
import { EventDeserializer } from './deserializers/event.deserializer';

@Injectable()
export class EventsBridge
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private changeStream: ChangeStream<Document>;

  constructor(
    @InjectModel(Event.name, EVENT_STORE_CONNECTION)
    private readonly eventStore: Model<Event>,
    private readonly eventBus: EventBus,
    private readonly eventDeserializer: EventDeserializer,
  ) {}

  onApplicationBootstrap() {
    this.changeStream = this.eventStore
      .watch()
      .on('change', (change: ChangeStreamInsertDocument<EventDocument>) => {
        if (change.operationType === 'insert') {
          this.handleEventStoreChange(change);
        }
      }) as unknown as ChangeStream<Document>;
  }

  onApplicationShutdown() {
    return this.changeStream.close();
  }

  handleEventStoreChange(change: ChangeStreamInsertDocument<EventDocument>) {
    const insertedEvent = change.fullDocument;

    this.eventBus.subject$.next(
      this.eventDeserializer.deserialize(insertedEvent).data,
    );
  }
}
