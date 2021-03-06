import {QboMetaData} from "./subTypes/QboMetaData";
import {ReferenceType} from "./subTypes/ClassRef";

export interface Class {
    /**
     * read only, system defined
String , filterable , sortable
Fully qualified name of the entity. 
The fully qualified name prepends the topmost parent, followed by each sub class separated by colons.
 Takes the form of Parent:Class1:SubClass1:SubClass2. Limited to 5 levels.
     */
    FullyQualifiedName?: string;
    domain: "QBO";
    /**
     *
max character: maximum of 100 chars
String
User recognizable name for the Class.
     */
    Name: string;
    /**
     * Version number of the object. 
     * It is used to lock an object for use by one app at a time.
     *  As soon as an application modifies an object, its SyncToken is incremented.
     *  Attempts to modify an object specifying an older SyncToken fails.
     *  Only the latest version of the object is maintained by QuickBooks Online.
     */
    SyncToken?: string;
    /**
     * Specifies whether this object is a subclass. true--this object represents a subclass. false or null--this object represents a top-level class.
     */
    SubClass?: boolean;
    sparse?: boolean;
    /**
     * If true, this entity is currently enabled for use by QuickBooks.
     */
    Active: boolean;
    /**
     *
read only, system defined
String , filterable , sortable
Unique identifier for this object. Sort order is ASC by default.
     */
    Id?: string;
    /**
     * Descriptive information about the object. The MetaData values are set by Data Services and are read only for all applications.
     */
    MetaData?: QboMetaData;
    time?: Date;
    /**
     * Conditionally required
ReferenceType
The immediate parent of the SubClass. Required if this object is a subclass
     */
    ParentRef?: ReferenceType
}


